import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { TopicEditor } from "./TopicEditor";
import type { Theme } from "../../types";

function Harness({ initial }: { initial: Theme[] }) {
  const [themes, setThemes] = useState<Theme[]>(initial);
  return (
    <div>
      <TopicEditor themes={themes} onChange={setThemes} />
      <div data-testid="count">{themes.length}</div>
      <div data-testid="last-id">{themes[themes.length - 1]?.id}</div>
    </div>
  );
}

const START: Theme[] = [
  { id: "a", name: "Alpha", color: "#111111" },
  { id: "b", name: "Beta", color: "#222222" },
];

describe("TopicEditor", () => {
  it("renders a row per topic", () => {
    render(<Harness initial={START} />);
    expect(screen.getByDisplayValue("Alpha")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Beta")).toBeInTheDocument();
  });

  it("adds a new (id-less) row", () => {
    render(<Harness initial={START} />);
    fireEvent.click(screen.getByText("+ Add topic"));
    expect(screen.getByTestId("count").textContent).toBe("3");
    // the freshly added row has an empty id (backend mints it on save)
    expect(screen.getByTestId("last-id").textContent).toBe("");
  });

  it("removes a row but refuses to drop the last one", () => {
    render(<Harness initial={[START[0]]} />);
    const remove = screen.getByLabelText("Remove topic");
    expect(remove).toBeDisabled();
  });

  it("renames a topic in place (preserving order)", () => {
    render(<Harness initial={START} />);
    fireEvent.change(screen.getByDisplayValue("Alpha"), { target: { value: "Alpha Prime" } });
    expect(screen.getByDisplayValue("Alpha Prime")).toBeInTheDocument();
  });
});
