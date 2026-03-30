import { expect, it } from "vitest";
import { db } from "../src/db/client";

it("exports db client", () => {
  expect(db).toBeDefined();
});
