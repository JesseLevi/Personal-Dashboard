import { describe, expect, it } from "vitest";
import { BAR_COMMAND_IDS, OVERFLOW_COMMAND_IDS } from "@/components/organisms/EditingBar";

// The 20 commands of the pre-#333 bar must stay reachable: on the bar or in
// the overflow (inline marks and block types are also in the bubble / slash menus).
const OLD_BAR = [
  "undo", "redo", "blockType", "list", "blockquote", "table", "codeBlock", "code",
  "bold", "italic", "strikethrough", "underline", "highlight", "link",
  "superscript", "subscript", "alignLeft", "alignCenter", "alignRight", "alignJustify",
];

describe("slim EditingBar", () => {
  it("keeps every command of the old bar on the bar or in the overflow", () => {
    const reachable = new Set([...BAR_COMMAND_IDS, ...OVERFLOW_COMMAND_IDS]);
    expect(OLD_BAR.filter((id) => !reachable.has(id))).toEqual([]);
  });

  it("offers the image insert on desktop (overflow row) and mobile (labelled bar button), #339", () => {
    expect(OVERFLOW_COMMAND_IDS).toContain("image");
    expect(BAR_COMMAND_IDS.at(-1)).toBe("image");
  });

  it("keeps the essentials on the bar itself", () => {
    expect(BAR_COMMAND_IDS).toEqual([
      "undo", "redo", "blockType", "list", "table", "bold", "italic", "link", "overflow", "image",
    ]);
  });
});
