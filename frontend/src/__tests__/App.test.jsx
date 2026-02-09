import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import App from "../App";

const mockGreetings = [
  { id: 1, message: "Hello, World!" },
  { id: 2, message: "Hola, Mundo!" },
];

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn((url) => {
    if (url.includes("/greetings")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockGreetings),
      });
    }
    if (url.includes("/hello")) {
      const name = new URL(url, "http://localhost").searchParams.get("name");
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ id: 1, message: `Hello, ${name || "World"}!` }),
      });
    }
    return Promise.resolve({ ok: false, status: 404 });
  });
});

describe("App", () => {
  it("renders the header", () => {
    render(<App />);
    expect(screen.getByText("Hello World")).toBeInTheDocument();
    expect(
      screen.getByText("A modern full-stack greeting app")
    ).toBeInTheDocument();
  });

  it("loads and displays greetings list", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Hello, World!")).toBeInTheDocument();
      expect(screen.getByText("Hola, Mundo!")).toBeInTheDocument();
    });
  });

  it("fetches personalized greeting on form submit", async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByLabelText("Name");
    await user.type(input, "React");
    await user.click(screen.getByText("Greet"));

    await waitFor(() => {
      expect(screen.getByText("Hello, React!")).toBeInTheDocument();
    });
  });

  it("fetches default greeting when name is empty", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText("Greet"));

    await waitFor(() => {
      expect(screen.getByText("Greeting #1")).toBeInTheDocument();
    });
  });

  it("shows error on API failure", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 500 })
    );
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText("Greet"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
});
