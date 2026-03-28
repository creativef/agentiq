import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import App from "../src/App";

it("renders Mission Control shell", () => {
  render(<App />);
  expect(screen.getByText(/Mission Control/i)).toBeInTheDocument();
});
