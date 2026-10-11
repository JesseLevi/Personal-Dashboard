import { describe, expect, it } from "vitest";
import { ALIGN_MENU, BAR_COMMAND_IDS, OVERFLOW_COMMAND_IDS } from "@/components/organisms/EditingBar";

// The 20 commands of the pre-#333 bar must stay reachable: on the bar or in
// the overflow (inline marks and block types are also in the bubble / slash menus).
const OLD_BAR = [
  "undo", "redo", "blockType", "list", "blockquote", "table", "codeBlock", "code",
  "bold", "italic", "strikethrough", "underline", "highlight", "link",
  "superscript", "subscript", "alignLeft", "alignCenter", "alignRight", "alignJustify",
];

describe("slim EditingBar", () => {
  it("keeps every command of the old bar on the bar or in the overflow", () => {
    const reachable = new Set([...BAR_COMMAND_IDS, ...OVERFLOW_COMMAND_IDS, ...ALIGN_MENU.options.map((option) => option.id)]);
    expect(OLD_BAR.filter((id) => !reachable.has(id))).toEqual([]);
  });

  it("keeps image and alignment on the bar and the overflow last, #339/#386", () => {
    expect(BAR_COMMAND_IDS).toContain("image");
    expect(BAR_COMMAND_IDS).toContain("align");
    expect(OVERFLOW_COMMAND_IDS).not.toContain("image");
    expect(BAR_COMMAND_IDS.at(-1)).toBe("overflow");
  });

  it("offers all four alignments as options of the align menu, #386", () => {
    expect(ALIGN_MENU.options.map((option) => option.id)).toEqual([
      "alignLeft", "alignCenter", "alignRight", "alignJustify",
    ]);
  });

  it("keeps the essentials on the bar itself", () => {
    expect(BAR_COMMAND_IDS).toEqual([
      "blockType", "list", "table", "bold", "italic", "link", "align", "image", "undo", "redo", "overflow",
    ]);
  });
});
