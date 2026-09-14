import { vi } from "vitest";

// `server-only` throws when imported outside a React Server Components bundle.
vi.mock("server-only", () => ({}));
