// Vitest setup — runs before each test file
import "@testing-library/jest-dom";
import { vi } from "vitest";

// Silence console.error in tests unless VERBOSE_TESTS is set
if (!process.env.VERBOSE_TESTS) {
  vi.spyOn(console, "error").mockImplementation(() => {});
}
