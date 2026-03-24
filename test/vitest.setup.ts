import { describe } from "vitest";

// Preserve Mocha's context alias used across the legacy test suite.
(globalThis as { context?: typeof describe }).context = describe;
