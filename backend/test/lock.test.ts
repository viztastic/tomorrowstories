import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, mintViewToken, verifyViewToken } from "../src/shared/lock.js";

describe("password hashing", () => {
  it("verifies the correct password and rejects wrong ones", () => {
    const lock = hashPassword("swordfish");
    expect(verifyPassword("swordfish", lock)).toBe(true);
    expect(verifyPassword("Swordfish", lock)).toBe(false);
    expect(verifyPassword("", lock)).toBe(false);
  });

  it("salts each hash so the same password hashes differently", () => {
    const a = hashPassword("same");
    const b = hashPassword("same");
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
    expect(verifyPassword("same", a)).toBe(true);
    expect(verifyPassword("same", b)).toBe(true);
  });
});

describe("view tokens", () => {
  const lock = hashPassword("pw1234");

  it("accepts a freshly minted token for the same event", () => {
    expect(verifyViewToken("evt1", lock, mintViewToken("evt1", lock))).toBe(true);
  });

  it("rejects a token minted for a different event", () => {
    expect(verifyViewToken("evt2", lock, mintViewToken("evt1", lock))).toBe(false);
  });

  it("rejects every outstanding token once the password (hash) changes", () => {
    const token = mintViewToken("evt1", lock);
    const rotated = hashPassword("pw1234"); // new salt → new hash → new signing key
    expect(verifyViewToken("evt1", rotated, token)).toBe(false);
  });

  it("rejects an expired token", () => {
    // Mint 13h in the past so its 12h TTL has already elapsed.
    const stale = mintViewToken("evt1", lock, Date.now() - 13 * 60 * 60 * 1000);
    expect(verifyViewToken("evt1", lock, stale)).toBe(false);
  });

  it("rejects tampered or malformed tokens", () => {
    const token = mintViewToken("evt1", lock);
    const [exp, sig] = token.split(".");
    const flipped = (sig[0] === "a" ? "b" : "a") + sig.slice(1);
    expect(verifyViewToken("evt1", lock, `${exp}.${flipped}`)).toBe(false);
    expect(verifyViewToken("evt1", lock, "garbage")).toBe(false);
    expect(verifyViewToken("evt1", lock, "")).toBe(false);
  });
});
