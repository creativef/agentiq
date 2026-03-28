import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import CompanyOrg from "../src/pages/CompanyOrg";

it("renders Company Org page", () => {
  render(<CompanyOrg />);
  expect(screen.getByText(/Org Chart/i)).toBeInTheDocument();
});
