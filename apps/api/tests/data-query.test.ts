import { expect, it, vi } from "vitest";

vi.mock("../src/db/client", () => ({
  db: {
    select: () => ({ from: () => [], limit: () => [] }),
  },
}));

import { app } from "../src/index";

it("returns events", async () => {
  const res = await app.request("/events");
  expect(res.status).toBe(200);
});
