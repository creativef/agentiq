import { expect, it } from "vitest";
import { app } from "../src/index";

it("lists companies", async () => {
  const res = await app.request("/companies");
  expect(res.status).toBe(200);
});
