import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import CompanyPanel from "../src/components/Overview/CompanyPanel";

vi.mock("../src/lib/api", () => ({
  getEvents: () => Promise.resolve([]),
}));

it("renders last event", async () => {
  render(<CompanyPanel />);
  expect(await screen.findByText(/No events/i)).toBeInTheDocument();
});
