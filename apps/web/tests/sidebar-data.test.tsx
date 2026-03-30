import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import Sidebar from "../src/components/Sidebar";

vi.mock("../src/lib/api", () => ({
  getCompanies: () => Promise.resolve([]),
}));

it("renders empty companies state", async () => {
  render(<Sidebar />);
  expect(await screen.findByText(/No companies/i)).toBeInTheDocument();
});
