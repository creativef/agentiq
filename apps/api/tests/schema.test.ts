import { expect, it } from "vitest";
import { companies } from "../src/db/schema";

it("has companies table", () => {
  expect(companies).toBeDefined();
});
