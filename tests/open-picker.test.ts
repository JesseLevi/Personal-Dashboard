import { describe, expect, it, vi } from "vitest";
import { hasNativePicker, openPicker } from "@/lib/ui/open-picker";

describe("openPicker", () => {
  it("opens the picker of date and time inputs", () => {
    for (const type of ["date", "time"]) {
      const showPicker = vi.fn();
      openPicker({ type, showPicker });
      expect(showPicker).toHaveBeenCalledOnce();
    }
  });

  it("leaves other, read-only and disabled inputs alone", () => {
    const showPicker = vi.fn();
    openPicker({ type: "text", showPicker });
    openPicker({ type: "date", readOnly: true, showPicker });
    openPicker({ type: "date", disabled: true, showPicker });
    expect(showPicker).not.toHaveBeenCalled();
    expect(hasNativePicker(undefined)).toBe(false);
  });

  it("survives a missing or throwing showPicker", () => {
    expect(() => openPicker({ type: "date" })).not.toThrow();
    const showPicker = vi.fn(() => {
      throw new DOMException("no activation", "NotAllowedError");
    });
    expect(() => openPicker({ type: "time", showPicker })).not.toThrow();
  });
});
