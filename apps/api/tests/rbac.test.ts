import { expect, it } from "vitest";
import { canAccess } from "../src/middleware/rbac";

it("owner can access any company", () => {
  expect(canAccess("OWNER", "any", "any")).toBe(true);
});
