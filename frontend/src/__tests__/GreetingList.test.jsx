import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import GreetingList from "../components/GreetingList";

describe("GreetingList", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading state initially", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));
    render(<GreetingList apiBase="/api" />);
    expect(screen.getByText("Loading greetings...")).toBeInTheDocument();
  });

  it("renders greetings after fetch", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve([
            { id: 1, message: "Hello!" },
            { id: 2, message: "Hola!" },
          ]),
      })
    );
    render(<GreetingList apiBase="/api" />);

    await waitFor(() => {
      expect(screen.getByText("Hello!")).toBeInTheDocument();
      expect(screen.getByText("Hola!")).toBeInTheDocument();
    });
  });

  it("shows fallback message on fetch error", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("fail")));
    render(<GreetingList apiBase="/api" />);

    await waitFor(() => {
      expect(
        screen.getByText("Could not load greetings. Is the API running?")
      ).toBeInTheDocument();
    });
  });
});
