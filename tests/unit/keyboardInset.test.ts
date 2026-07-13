import { describe, expect, it } from "vitest";
import { computeKeyboardInset } from "../../src/ui/keyboardInset";

describe("keyboard inset", () => {
  it("computes the visual viewport overlap", () => {
    expect(computeKeyboardInset(800, 500, 0)).toBe(300);
    expect(computeKeyboardInset(800, 500, 50)).toBe(250);
  });

  it("clamps negative overlap to zero", () => {
    expect(computeKeyboardInset(800, 820, 0)).toBe(0);
    expect(computeKeyboardInset(800, 700, 150)).toBe(0);
  });
});
