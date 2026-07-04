import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VideoCard } from "./VideoCard";
import { THEMES } from "../../design";
import type { VideoDTO } from "../../types";

const theme = THEMES[0];
const base: VideoDTO = {
  id: "v1",
  title: "My clip",
  theme: "human",
  author: "You",
  status: "live",
  durationSec: 2,
  likes: 0,
  mediaUrl: null,
  posterUrl: null,
  createdAt: new Date().toISOString(),
};

function renderCard(v: VideoDTO) {
  return render(<VideoCard video={v} theme={theme} onOpen={() => {}} />);
}

describe("VideoCard status states", () => {
  it("shows a clear failed state instead of an endless spinner", () => {
    renderCard({ ...base, status: "failed" });
    expect(screen.getByText(/couldn.t process/i)).toBeInTheDocument();
    expect(screen.getByText(/try uploading again/i)).toBeInTheDocument();
  });

  it("shows Processing while transcoding", () => {
    renderCard({ ...base, status: "processing" });
    expect(screen.getByText(/^processing/i)).toBeInTheDocument();
  });

  it("nudges the user when processing is taking unusually long", () => {
    const old = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    renderCard({ ...base, status: "processing", createdAt: old });
    expect(screen.getByText(/still processing/i)).toBeInTheDocument();
  });

  it("a live video is not stuck in a processing/failed overlay", () => {
    renderCard({ ...base, status: "live" });
    expect(screen.queryByText(/processing/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/couldn.t process/i)).not.toBeInTheDocument();
  });
});
