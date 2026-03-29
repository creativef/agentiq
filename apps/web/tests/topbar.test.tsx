import { render, screen } from "@testing-library/react";
import TopBar from "../src/components/TopBar";

it("renders primary tabs", () => {
  render(<TopBar active="Overview" />);
  expect(screen.getByText(/Overview/i)).toBeInTheDocument();
  expect(screen.getByText(/Chat/i)).toBeInTheDocument();
  expect(screen.getByText(/Tasks/i)).toBeInTheDocument();
  expect(screen.getByText(/Calendar/i)).toBeInTheDocument();
  expect(screen.getByText(/Files/i)).toBeInTheDocument();
});
