import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useParams } from "react-router-dom";
import { Landing } from "./Landing";
import { demo } from "../demo";

function EventProbe() {
  const { eventId } = useParams();
  return <div>WALL:{eventId}</div>;
}

function renderJoin() {
  return render(
    <MemoryRouter initialEntries={["/join"]}>
      <Routes>
        <Route path="/join" element={<Landing mode="join" />} />
        <Route path="/e/:eventId" element={<EventProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Landing — join by code", () => {
  it("shows an inline error for a blank submit", () => {
    renderJoin();
    fireEvent.click(screen.getByRole("button", { name: /join event/i }));
    // "paste the event link" only appears in the error, not the subtitle.
    expect(screen.getByText(/paste the event link/i)).toBeInTheDocument();
  });

  it("shows an inline error for an unknown code", async () => {
    renderJoin();
    fireEvent.change(screen.getByPlaceholderText(/event code/i), { target: { value: "ZZZZZ" } });
    fireEvent.click(screen.getByRole("button", { name: /join event/i }));
    expect(await screen.findByText(/find that event/i)).toBeInTheDocument();
  });

  it("navigates to the wall when the code resolves", async () => {
    const ev = demo.createEvent("Test Event");
    renderJoin();
    fireEvent.change(screen.getByPlaceholderText(/event code/i), { target: { value: ev.code } });
    fireEvent.click(screen.getByRole("button", { name: /join event/i }));
    await waitFor(() => expect(screen.getByText(`WALL:${ev.eventId}`)).toBeInTheDocument());
  });

  it("navigates straight through when given a full /e/ link", async () => {
    render(
      <MemoryRouter initialEntries={["/join"]}>
        <Routes>
          <Route path="/join" element={<Landing mode="join" />} />
          <Route path="/e/:eventId" element={<EventProbe />} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.change(screen.getByPlaceholderText(/event code/i), {
      target: { value: "https://x.cloudfront.net/e/abcdef123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /join event/i }));
    await waitFor(() => expect(screen.getByText("WALL:abcdef123456")).toBeInTheDocument());
  });
});

describe("Landing — modes", () => {
  it("join mode hides the organizer create card", () => {
    render(
      <MemoryRouter>
        <Landing mode="join" />
      </MemoryRouter>
    );
    expect(screen.queryByText(/start an event/i)).not.toBeInTheDocument();
  });

  it("create mode hides the join card", () => {
    render(
      <MemoryRouter>
        <Landing mode="create" />
      </MemoryRouter>
    );
    expect(screen.queryByText(/join the wall/i)).not.toBeInTheDocument();
  });
});
