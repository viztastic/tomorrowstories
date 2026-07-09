import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useParams } from "react-router-dom";
import { Home } from "./Home";
import { demo } from "../demo";

function EventProbe() {
  const { eventId } = useParams();
  return <div>WALL:{eventId}</div>;
}

function renderHome() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/e/:eventId" element={<EventProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

// The page carries the join field in several places (hero, closing door, sticky
// bar). The hero card is the first interactive element — the one a mid-event
// attendee hits — so we scope to it via its test id and drive that one form.
const hero = () => within(screen.getByTestId("hero-join"));
const heroInput = () => hero().getByPlaceholderText(/event code/i);
const heroJoin = () => hero().getByRole("button", { name: /join event/i });

describe("Home — join by code", () => {
  it("still couches a way to join an event and a way to start one", () => {
    renderHome();
    expect(screen.getAllByRole("button", { name: /join event/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /start a wall/i }).length).toBeGreaterThan(0);
  });

  it("shows an inline error for a blank submit", () => {
    renderHome();
    fireEvent.click(heroJoin());
    expect(screen.getByText(/paste the event link/i)).toBeInTheDocument();
  });

  it("shows an inline error for an unknown code", async () => {
    renderHome();
    fireEvent.change(heroInput(), { target: { value: "ZZZZZ" } });
    fireEvent.click(heroJoin());
    expect(await screen.findByText(/find that event/i)).toBeInTheDocument();
  });

  it("navigates to the wall when the code resolves", async () => {
    const ev = demo.createEvent("Home Test Event");
    renderHome();
    fireEvent.change(heroInput(), { target: { value: ev.code } });
    fireEvent.click(heroJoin());
    await waitFor(() => expect(screen.getByText(`WALL:${ev.eventId}`)).toBeInTheDocument());
  });

  it("navigates straight through when given a full /e/ link", async () => {
    renderHome();
    fireEvent.change(heroInput(), { target: { value: "https://x.cloudfront.net/e/abcdef123456" } });
    fireEvent.click(heroJoin());
    await waitFor(() => expect(screen.getByText("WALL:abcdef123456")).toBeInTheDocument());
  });
});
