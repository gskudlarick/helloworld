import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import GreetingForm from "../components/GreetingForm";

describe("GreetingForm", () => {
  it("renders input and button", () => {
    render(<GreetingForm onSubmit={() => {}} />);
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByText("Greet")).toBeInTheDocument();
  });

  it("calls onSubmit with trimmed name", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<GreetingForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Name"), "  Alice  ");
    await user.click(screen.getByText("Greet"));

    expect(onSubmit).toHaveBeenCalledWith("Alice");
  });

  it("calls onSubmit with empty string when input is blank", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<GreetingForm onSubmit={onSubmit} />);

    await user.click(screen.getByText("Greet"));

    expect(onSubmit).toHaveBeenCalledWith("");
  });
});
