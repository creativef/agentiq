import { render } from "@testing-library/react";
import Sidebar from "../src/components/Sidebar";

it("sidebar has class for layout", () => {
  render(<Sidebar />);
  expect(document.querySelector("aside")?.className).toMatch(/sidebar/);
});
