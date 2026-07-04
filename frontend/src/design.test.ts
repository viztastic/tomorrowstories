import { describe, it, expect } from "vitest";
import { initials, fmtLikes, fmtDur, pairFor, stillBg, THEMES } from "./design";

describe("design helpers", () => {
  it("initials takes up to two uppercased initials", () => {
    expect(initials("Maya Chen")).toBe("MC");
    expect(initials("Diego")).toBe("D");
    expect(initials("a b c")).toBe("AB");
    expect(initials("")).toBe("");
  });

  it("fmtLikes abbreviates thousands", () => {
    expect(fmtLikes(0)).toBe("0");
    expect(fmtLikes(999)).toBe("999");
    expect(fmtLikes(1000)).toBe("1k");
    expect(fmtLikes(1500)).toBe("1.5k");
    expect(fmtLikes(2140)).toBe("2.1k");
  });

  it("fmtDur formats m:ss", () => {
    expect(fmtDur(0)).toBe("0:00");
    expect(fmtDur(52)).toBe("0:52");
    expect(fmtDur(60)).toBe("1:00");
    expect(fmtDur(125)).toBe("2:05");
  });

  it("pairFor is deterministic and anchored on the theme colour", () => {
    const t = THEMES[0];
    const a = pairFor(t, "v1");
    const b = pairFor(t, "v1");
    expect(a).toEqual(b);
    expect(a[0]).toBe(t.color);
    // different seeds can pick a different partner colour
    expect(pairFor(t, "v1")).not.toBeUndefined();
  });

  it("stillBg embeds both colours of the pair", () => {
    const bg = stillBg(["#111111", "#222222"]);
    expect(bg).toContain("#111111");
    expect(bg).toContain("#222222");
    expect(bg).toContain("linear-gradient");
  });
});
