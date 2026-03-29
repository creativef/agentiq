import { render, screen } from "@testing-library/react";
import Sidebar from "../src/components/Sidebar";

it("renders company tree", () => {
  render(<Sidebar />);
  expect(screen.getByText(/Companies/i)).toBeInTheDocument();
  expect(screen.getByText(/Projects/i)).toBeInTheDocument();
  expect(screen.getByText(/Agents/i)).toBeInTheDocument();
});
