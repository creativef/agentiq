import { render, screen } from "@testing-library/react";
import CompanyPanel from "../src/components/Overview/CompanyPanel";

it("renders company goal", () => {
  render(<CompanyPanel />);
  expect(screen.getByText(/Company Goal/i)).toBeInTheDocument();
  expect(screen.getByText(/Org Snapshot/i)).toBeInTheDocument();
});
