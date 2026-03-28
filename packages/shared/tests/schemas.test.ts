import { expect, it } from "vitest";
import { roleSchema } from "../src/schemas";

it("rejects invalid roles", () => {
  expect(() => roleSchema.parse("INVALID")).toThrow();
});
