import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LockGate } from "./LockGate";
import { demo } from "../demo";

// Runs under VITE_DEMO=1, so api.unlock resolves against the in-memory demo store.
function renderGate(eventId: string) {
  const onUnlocked = vi.fn();
  render(
    <MemoryRouter>
      <LockGate eventId={eventId} onUnlocked={onUnlocked} />
    </MemoryRouter>
  );
  return onUnlocked;
}

describe("LockGate", () => {
  it("unlocks with the correct password and calls onUnlocked", async () => {
    const ev = demo.createEvent("Locked");
    demo.updateEvent(ev.eventId, { viewPassword: "secret" });
    const onUnlocked = renderGate(ev.eventId);

    fireEvent.change(screen.getByLabelText(/event password/i), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /unlock/i }));

    await waitFor(() => expect(onUnlocked).toHaveBeenCalled());
  });

  it("shows an error and does not unlock on the wrong password", async () => {
    const ev = demo.createEvent("Locked2");
    demo.updateEvent(ev.eventId, { viewPassword: "secret" });
    const onUnlocked = renderGate(ev.eventId);

    fireEvent.change(screen.getByLabelText(/event password/i), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /unlock/i }));

    await waitFor(() => expect(screen.getByText(/incorrect password/i)).toBeInTheDocument());
    expect(onUnlocked).not.toHaveBeenCalled();
  });
});
