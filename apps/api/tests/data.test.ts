import { expect, it } from "vitest";
import { expect, it, vi } from "vitest";

vi.mock("../src/db/client", () => ({
  db: {
    select: () => ({ from: () => [] }),
  },
}));

import { app } from "../src/index";

it("lists companies", async () => {
  const res = await app.request("/companies");
  expect(res.status).toBe(200);
});
