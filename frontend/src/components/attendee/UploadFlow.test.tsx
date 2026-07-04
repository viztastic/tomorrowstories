import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UploadFlow } from "./UploadFlow";
import { THEMES } from "../../design";

describe("UploadFlow — capture choice", () => {
  it("offers both record and camera-roll paths on step 1", () => {
    render(<UploadFlow eventId="e1" themes={THEMES} onUploaded={() => {}} onClose={() => {}} />);
    expect(screen.getByText("Record a video")).toBeInTheDocument();
    expect(screen.getByText(/Choose from camera roll/i)).toBeInTheDocument();
  });

  it("renders two hidden file inputs — one capture-biased, one library", () => {
    const { container } = render(<UploadFlow eventId="e1" themes={THEMES} onUploaded={() => {}} onClose={() => {}} />);
    const inputs = container.querySelectorAll('input[type="file"]');
    expect(inputs).toHaveLength(2);
    // exactly one carries the `capture` hint (the record path)
    const withCapture = [...inputs].filter((i) => i.hasAttribute("capture"));
    expect(withCapture).toHaveLength(1);
    expect([...inputs].every((i) => i.getAttribute("accept") === "video/*")).toBe(true);
  });
});
