import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import OpsDashboard from "../src/pages/OpsDashboard";

it("shows live status", () => {
  render(<OpsDashboard />);
  expect(screen.getByText(/Live Status/i)).toBeInTheDocument();
});
