import { render } from "@testing-library/react";
import TopBar from "../src/components/TopBar";

it("top bar has class for tabs", () => {
  render(<TopBar active="Overview" />);
  expect(document.querySelector("header")?.className).toMatch(/topbar/);
});
