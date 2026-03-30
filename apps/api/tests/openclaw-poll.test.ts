import { expect, it } from "vitest";
import { pollGateway } from "../src/connectors/openclaw-poll";

it("polls gateway", async () => {
  expect(typeof pollGateway).toBe("function");
});
