import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FacilitatorTable } from "./BigScreen";
import type { Theme, VideoDTO } from "../../types";

// Tests run with VITE_DEMO=1, so api.deleteVideo/deleteVideos hit the in-memory
// demo store (no network). The table hides a deleted row locally too, which is
// what we assert on.

const themes: Theme[] = [{ id: "human", name: "Human", color: "#8B5CF6" }];

function vid(id: string, title: string): VideoDTO {
  return { id, title, theme: "human", author: "Ava", status: "live", durationSec: 30, likes: 0, mediaUrl: null, posterUrl: null, createdAt: `2026-07-0${id}T00:00:00Z` };
}

function renderTable(videos: VideoDTO[], refresh = vi.fn()) {
  render(
    <MemoryRouter>
      <FacilitatorTable eventId="e1" live={videos} themes={themes} onOpen={() => {}} refresh={refresh} />
    </MemoryRouter>
  );
  return refresh;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("FacilitatorTable — organizer moderation", () => {
  it("renders a select-all checkbox and a delete control per row", () => {
    renderTable([vid("1", "Alpha"), vid("2", "Bravo")]);
    expect(screen.getByLabelText(/select all stories/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/delete .*Alpha/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/delete .*Bravo/i)).toBeInTheDocument();
  });

  it("deletes a single story and removes just that row", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const refresh = renderTable([vid("1", "Alpha"), vid("2", "Bravo")]);

    fireEvent.click(screen.getByLabelText(/delete .*Alpha/i));

    await waitFor(() => expect(screen.queryByText("Alpha")).not.toBeInTheDocument());
    expect(screen.getByText("Bravo")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("select-all then bulk delete clears every row", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const refresh = renderTable([vid("1", "Alpha"), vid("2", "Bravo")]);

    fireEvent.click(screen.getByLabelText(/select all stories/i));
    expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /delete selected/i }));

    await waitFor(() => expect(screen.queryByText("Alpha")).not.toBeInTheDocument());
    expect(screen.queryByText("Bravo")).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("keeps the row when the confirm is declined", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const refresh = renderTable([vid("1", "Alpha")]);

    fireEvent.click(screen.getByLabelText(/delete .*Alpha/i));

    // give any (unexpected) async delete a tick to settle
    await Promise.resolve();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
