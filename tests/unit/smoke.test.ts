import { describe, expect, it } from "vitest";

describe("tooling smoke test", () => {
  it("runs unit tests", () => {
    expect("老公菜谱").toContain("菜谱");
  });
});
