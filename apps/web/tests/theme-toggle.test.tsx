import { render, screen } from "@testing-library/react";
import ThemeToggle from "../src/components/ThemeToggle";

it("renders theme toggle", () => {
  render(<ThemeToggle />);
  expect(screen.getByRole("button", { name: /theme/i })).toBeInTheDocument();
});
