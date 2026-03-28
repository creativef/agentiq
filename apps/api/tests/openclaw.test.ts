import { expect, it } from "vitest";
import { normalizeEvent } from "../src/connectors/openclaw";

it("normalizes raw gateway event", () => {
  const evt = normalizeEvent({ type: "task.started", data: { taskId: "t1" } } as any);
  expect(evt.type).toBe("task.started");
});
