/**
 * Node MSW server for Vitest. `vitest.setup.ts` starts it for every test file.
 */
import { setupServer } from "msw/node";
import { createHandlers } from "./handlers";

export const server = setupServer(...createHandlers());
