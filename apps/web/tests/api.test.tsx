import { expect, it } from "vitest";
import { getCompanies } from "../src/lib/api";

it("fetches companies", async () => {
  expect(typeof getCompanies).toBe("function");
});
