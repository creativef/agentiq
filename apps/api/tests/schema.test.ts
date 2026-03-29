import { expect, it } from "vitest";
import { companies, projects, agents, tasks, events } from "../src/db/schema";

it("defines core tables", () => {
  expect(companies).toBeDefined();
  expect(projects).toBeDefined();
  expect(agents).toBeDefined();
  expect(tasks).toBeDefined();
  expect(events).toBeDefined();
});
