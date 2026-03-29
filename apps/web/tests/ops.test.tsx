import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import OpsDashboard from "../src/pages/OpsDashboard";

it("shows overview", () => {
  render(<OpsDashboard />);
  expect(screen.getByText(/Overview/i)).toBeInTheDocument();
});
