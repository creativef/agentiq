import { render } from "@testing-library/react";
import OpsDashboard from "../src/pages/OpsDashboard";

it("overview uses widget classes", () => {
  render(<OpsDashboard />);
  expect(document.querySelector(".kpi-grid")).toBeTruthy();
  expect(document.querySelector(".status-wall")).toBeTruthy();
});
