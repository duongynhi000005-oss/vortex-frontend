import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "@/mocks/server";

// Shared MSW route table (src/mocks/handlers.ts). Unmatched requests pass
// through so existing tests that stub fetch or hit real URLs keep working.
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = String(value);
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    for (const k of Object.keys(store)) {
      delete store[k];
    }
  },
  get length() {
    return Object.keys(store).length;
  },
  key: (index: number) => Object.keys(store)[index] ?? null,
};

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});

if (!navigator.clipboard) {
  Object.defineProperty(navigator, "clipboard", {
    value: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
    writable: true,
    configurable: true,
  });
}
