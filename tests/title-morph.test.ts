import { afterEach, describe, expect, it } from "vitest";
import {
  armTitleMorph,
  clearTitleMorph,
  peekTitleMorph,
  registerLiveTitle,
} from "@/lib/ui/title-morph";

afterEach(() => clearTitleMorph());

describe("title morph handshake", () => {
  it("is empty until armed", () => {
    expect(peekTitleMorph()).toBeNull();
  });

  it("hands over the live title once armed, and keeps it until cleared", () => {
    const unregister = registerLiveTitle(() => ({ text: "Werk", width: 80 }));
    armTitleMorph(1000);
    expect(peekTitleMorph(1500)).toEqual({ text: "Werk", width: 80 });
    expect(peekTitleMorph(1600)).toEqual({ text: "Werk", width: 80 });
    clearTitleMorph();
    expect(peekTitleMorph(1600)).toBeNull();
    unregister();
  });

  it("drops a snapshot left by a navigation that never landed", () => {
    const unregister = registerLiveTitle(() => ({ text: "Werk", width: 80 }));
    armTitleMorph(1000);
    expect(peekTitleMorph(1000 + 8000)).toBeNull();
    unregister();
  });

  it("arms nothing when no title is mounted", () => {
    armTitleMorph(1000);
    expect(peekTitleMorph(1001)).toBeNull();
  });
});
