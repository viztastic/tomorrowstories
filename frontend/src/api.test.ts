import { describe, it, expect } from "vitest";
import { buildS3Form } from "./api";

describe("buildS3Form (S3 presigned POST)", () => {
  const upload = {
    url: "https://raw-bucket.s3.ap-southeast-2.amazonaws.com/",
    fields: {
      key: "raw/evt/vid.mp4",
      "Content-Type": "video/mp4",
      Policy: "base64policy",
      "X-Amz-Signature": "sig",
    },
  };
  const file = new File([new Uint8Array([1, 2, 3])], "clip.mp4", { type: "video/mp4" });

  it("includes each signed field exactly once (no duplicate Content-Type → no 403)", () => {
    const form = buildS3Form(upload, file);
    expect(form.getAll("Content-Type")).toHaveLength(1);
    expect(form.get("Content-Type")).toBe("video/mp4");
    expect(form.get("key")).toBe("raw/evt/vid.mp4");
    expect(form.get("Policy")).toBe("base64policy");
  });

  it("appends the file last, after all policy fields", () => {
    const form = buildS3Form(upload, file);
    const keys = [...form.keys()];
    expect(keys[keys.length - 1]).toBe("file");
    expect(form.get("file")).toBeInstanceOf(File);
  });
});
