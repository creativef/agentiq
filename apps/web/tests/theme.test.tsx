// @vitest-environment node
import { readFileSync } from "node:fs";

it("defines light theme tokens", () => {
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
  expect(css).toContain("--bg: #F5F8F6");
});
