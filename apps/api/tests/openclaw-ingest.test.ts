import { expect, it, vi } from "vitest";

vi.mock("../src/db/client", () => ({
  db: {
    insert: () => ({ values: () => ({}) }),
  },
}));

import { app } from "../src/index";

it("ingests gateway event", async () => {
  const res = await app.request("/connectors/openclaw", { method: "POST" });
  expect(res.status).toBe(200);
});
