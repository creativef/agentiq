import { render, screen } from "@testing-library/react";
import OpsDashboard from "../src/pages/OpsDashboard";

it("renders overview widgets", () => {
  render(<OpsDashboard />);
  expect(screen.getByText(/Live Agents/i)).toBeInTheDocument();
  expect(screen.getByText(/Status Wall/i)).toBeInTheDocument();
  expect(screen.getByText(/Ops Timeline/i)).toBeInTheDocument();
  expect(screen.getByText(/Quick Actions/i)).toBeInTheDocument();
});
