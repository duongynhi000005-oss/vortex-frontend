#!/usr/bin/env node

/**
 * gen-api.mjs: generate TypeScript models and runtime parsers from the relay
 * OpenAPI snapshot (Issue #516).
 *
 * Usage:
 *   node scripts/gen-api.mjs                            write src/lib/generated/relay.ts
 *   node scripts/gen-api.mjs --check                    fail if the committed output is stale
 *   node scripts/gen-api.mjs --check --upstream <file>  also fail if <file> (the backend's
 *                                                       current spec) differs from the snapshot
 *
 * Supported subset of components.schemas. Anything else throws, so a spec change
 * this generator cannot express fails loudly instead of drifting silently:
 * - object: properties + required. Parsers strip keys that are not declared.
 * - string enum: unknown values parse to "unknown" at the boundary.
 * - string (format date-time, pattern), number, integer, boolean, const.
 * - $ref to another component.
 * - type: [T, "null"] for nullable scalars.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SPEC_PATH = path.join(ROOT, "spec", "relay.openapi.json");
const OUT_PATH = path.join(ROOT, "src", "lib", "generated", "relay.ts");

const REF_PREFIX = "#/components/schemas/";
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SCALAR_TYPES = new Set(["string", "number", "integer", "boolean"]);
const SCHEMA_KEYS = new Set(["type", "description", "properties", "required", "enum"]);
const PROPERTY_KEYS = new Set(["type", "description", "format", "pattern", "const", "$ref"]);

// Helpers are emitted only when a generated parser uses them, because the
// tsconfig sets noUnusedLocals.
const HELPERS = [
  {
    name: "isRecord",
    lines: [
      "function isRecord(value: unknown): value is Record<string, unknown> {",
      '  return typeof value === "object" && value !== null && !Array.isArray(value);',
      "}",
    ],
  },
  {
    name: "isDateTime",
    lines: ["function isDateTime(value: string): boolean {", "  return !Number.isNaN(Date.parse(value));", "}"],
  },
  {
    name: "enumValue",
    lines: [
      'function enumValue<T extends string>(value: unknown, values: readonly T[]): T | "unknown" {',
      '  return values.find((candidate) => candidate === value) ?? "unknown";',
      "}",
    ],
  },
];

function fail(where, message) {
  throw new Error(`${where}: ${message}`);
}

function assertKeys(where, node, allowed) {
  for (const key of Object.keys(node)) {
    if (!allowed.has(key)) fail(where, `unsupported keyword "${key}"`);
  }
}

function docComment(text) {
  return text ? [`/** ${text} */`] : [];
}

// Literal lists stay on one line when they fit in 80 columns, matching Prettier.
function constArray(prefix, items, suffix) {
  const inline = `${prefix}[${items.map((item) => JSON.stringify(item)).join(", ")}]${suffix}`;
  if (inline.length <= 80) return [inline];
  return [`${prefix}[`, ...items.map((item) => `  ${JSON.stringify(item)},`), `]${suffix}`];
}

function describeProperty(where, prop, ctx) {
  assertKeys(where, prop, PROPERTY_KEYS);
  if (prop.$ref !== undefined) {
    if (!prop.$ref.startsWith(REF_PREFIX)) fail(where, `unsupported $ref ${prop.$ref}`);
    const target = prop.$ref.slice(REF_PREFIX.length);
    if (!ctx.schemas[target]) fail(where, `$ref ${target} is not a component`);
    return { kind: "ref", name: target, isEnum: ctx.enumNames.has(target) };
  }
  if (prop.const !== undefined) {
    if (!["string", "number", "boolean"].includes(typeof prop.const)) {
      fail(where, "const must be a string, number or boolean");
    }
    return { kind: "const", value: prop.const };
  }
  let type = prop.type;
  let nullable = false;
  if (Array.isArray(type)) {
    const others = type.filter((entry) => entry !== "null");
    if (type.length !== 2 || others.length !== 1) fail(where, 'type arrays must be [T, "null"]');
    nullable = true;
    type = others[0];
  }
  if (!SCALAR_TYPES.has(type)) fail(where, `unsupported type ${JSON.stringify(prop.type)}`);
  if (prop.format !== undefined && !(type === "string" && prop.format === "date-time")) {
    fail(where, `unsupported format ${prop.format}`);
  }
  if (prop.pattern !== undefined && type !== "string") fail(where, "pattern only applies to strings");
  return { kind: "scalar", type, nullable, format: prop.format, pattern: prop.pattern };
}

function tsOf(desc) {
  if (desc.kind === "ref") return desc.name;
  if (desc.kind === "const") return JSON.stringify(desc.value);
  const base = desc.type === "integer" ? "number" : desc.type;
  return desc.nullable ? `${base} | null` : base;
}

// Returns a boolean expression that is true when `v` violates the schema.
// Runs after `v` has been read from the input, so it must handle `undefined`.
function failureExpr(v, desc, ctx) {
  if (desc.kind === "const") return `${v} !== ${JSON.stringify(desc.value)}`;
  const checks = [];
  if (desc.type === "string") {
    checks.push(`typeof ${v} !== "string"`);
    if (desc.pattern !== undefined) checks.push(`!new RegExp(${JSON.stringify(desc.pattern)}).test(${v})`);
    if (desc.format === "date-time") {
      ctx.helpers.add("isDateTime");
      checks.push(`!isDateTime(${v})`);
    }
  } else if (desc.type === "boolean") {
    checks.push(`typeof ${v} !== "boolean"`);
  } else {
    checks.push(`typeof ${v} !== "number"`);
    checks.push(desc.type === "integer" ? `!Number.isInteger(${v})` : `!Number.isFinite(${v})`);
  }
  if (desc.nullable) return `${v} !== null && (${checks.join(" || ")})`;
  return checks.join(" || ");
}

// Lines that read one property from `input`, validate it and, when present,
// store it on `out`. Output is relative to the parser body.
function fieldLines(field, ctx) {
  const src = `input[${JSON.stringify(field.key)}]`;
  const v = `v_${field.key}`;
  const desc = field.desc;
  let check;
  if (desc.kind === "ref" && desc.isEnum) {
    check = [`const ${v} = parse${desc.name}(${src});`];
    if (field.required) check.unshift(`if (${src} === undefined) return null;`);
  } else if (desc.kind === "ref") {
    check = [`const ${v} = parse${desc.name}(${src});`, `if (${v} === null) return null;`];
  } else {
    check = [`const ${v} = ${src};`, `if (${failureExpr(v, desc, ctx)}) return null;`];
  }
  if (field.required) return check;
  return [
    `if (${src} !== undefined) {`,
    ...check.map((line) => `  ${line}`),
    `  out.${field.key} = ${v};`,
    "}",
  ];
}

function emitEnum(name, schema, ctx) {
  assertKeys(name, schema, SCHEMA_KEYS);
  if (schema.type !== "string" || schema.enum.length === 0 || !schema.enum.every((v) => typeof v === "string")) {
    fail(name, "enums must be non-empty lists of strings");
  }
  ctx.helpers.add("enumValue");
  return [
    ...docComment(schema.description),
    ...constArray(`export const ${name}Values = `, schema.enum, " as const;"),
    `export type ${name} = (typeof ${name}Values)[number] | "unknown";`,
    "",
    `export function parse${name}(input: unknown): ${name} {`,
    `  return enumValue(input, ${name}Values);`,
    "}",
  ];
}

function emitObject(name, schema, ctx) {
  assertKeys(name, schema, SCHEMA_KEYS);
  if (schema.type !== "object" || typeof schema.properties !== "object") {
    fail(name, "only object and string-enum components are supported");
  }
  const requiredKeys = schema.required ?? [];
  for (const key of requiredKeys) {
    if (!(key in schema.properties)) fail(name, `required "${key}" is not declared in properties`);
  }
  const fields = Object.entries(schema.properties).map(([key, prop]) => {
    const where = `${name}.${key}`;
    if (!IDENT.test(key)) fail(where, "property names must be plain identifiers");
    return {
      key,
      required: requiredKeys.includes(key),
      desc: describeProperty(where, prop, ctx),
      doc: prop.description,
    };
  });
  ctx.helpers.add("isRecord");

  const required = fields.filter((field) => field.required);
  const optional = fields.filter((field) => !field.required);
  const body = [
    "if (!isRecord(input)) return null;",
    ...required.flatMap((field) => fieldLines(field, ctx)),
    ...(required.length === 0
      ? [`const out: ${name} = {};`]
      : [`const out: ${name} = {`, ...required.map((field) => `  ${field.key}: v_${field.key},`), "};"]),
    ...optional.flatMap((field) => fieldLines(field, ctx)),
    "return out;",
  ];

  return [
    ...docComment(schema.description),
    `export interface ${name} {`,
    ...fields.flatMap((field) => [
      ...docComment(field.doc).map((line) => `  ${line}`),
      `  ${field.key}${field.required ? "" : "?"}: ${tsOf(field.desc)};`,
    ]),
    "}",
    "",
    `export function parse${name}(input: unknown): ${name} | null {`,
    ...body.map((line) => `  ${line}`),
    "}",
  ];
}

export function generate(spec) {
  const schemas = spec?.components?.schemas;
  if (!schemas || typeof schemas !== "object") fail("spec", "components.schemas is missing");
  if (!spec.info?.title || !spec.info?.version) fail("spec", "info.title and info.version are required");

  const ctx = { schemas, enumNames: new Set(), helpers: new Set() };
  for (const [name, schema] of Object.entries(schemas)) {
    if (!IDENT.test(name)) fail(name, "component names must be plain identifiers");
    if (Array.isArray(schema.enum)) ctx.enumNames.add(name);
  }

  const models = Object.entries(schemas).map(([name, schema]) =>
    ctx.enumNames.has(name) ? emitEnum(name, schema, ctx) : emitObject(name, schema, ctx),
  );
  const helpers = HELPERS.filter((helper) => ctx.helpers.has(helper.name)).map((helper) => helper.lines);
  const header = [
    "// Code generated by scripts/gen-api.mjs. DO NOT EDIT.",
    `// Source: spec/relay.openapi.json (${spec.info.title} ${spec.info.version}, backend commit: ${spec.info["x-source"]?.commit ?? "unknown"})`,
  ];
  return [header, ...helpers, ...models].map((chunk) => chunk.join("\n")).join("\n\n") + "\n";
}

// Key order is sorted so that equal specs compare equal regardless of how the
// backend serialises them.
function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableJson(value[key])]));
  }
  return value;
}

function canonical(value) {
  return `${JSON.stringify(stableJson(value), null, 2)}\n`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function rel(file) {
  return path.relative(ROOT, file);
}

function main(argv) {
  const check = argv.includes("--check");
  const upstreamAt = argv.indexOf("--upstream");
  const upstream = upstreamAt === -1 ? null : argv[upstreamAt + 1];
  if (upstreamAt !== -1 && !upstream) throw new Error("--upstream needs a file path");

  const spec = readJson(SPEC_PATH);
  const output = generate(spec);

  if (!check) {
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, output);
    console.log(`wrote ${rel(OUT_PATH)}`);
    return 0;
  }

  const problems = [];
  const committed = fs.existsSync(OUT_PATH) ? fs.readFileSync(OUT_PATH, "utf8") : null;
  if (committed !== output) {
    problems.push(`${rel(OUT_PATH)} is stale; run npm run gen:api and commit the result`);
  }
  if (upstream && canonical(readJson(upstream)) !== canonical(spec)) {
    problems.push(
      `backend spec ${upstream} differs from ${rel(SPEC_PATH)}; follow docs/api-contract.md to update the snapshot`,
    );
  }
  if (problems.length > 0) {
    console.error("contract drift detected:");
    for (const problem of problems) console.error(`   - ${problem}`);
    return 1;
  }
  console.log(`contract OK (${rel(SPEC_PATH)} matches ${rel(OUT_PATH)})`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`gen-api: ${error.message}`);
    process.exitCode = 1;
  }
}
