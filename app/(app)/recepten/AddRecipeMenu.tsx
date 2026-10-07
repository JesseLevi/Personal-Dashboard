"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { Dropdown } from "@/components/atoms/Dropdown";
import { isOutsideAllContainers } from "@/lib/dom/outside-pointer";
import { usePopoverPosition } from "@/lib/dom/use-popover-position";

// "Via link / Handmatig" menu on a recipe column's Plus button — Figma
// "Add recipi dropdown/Desktop" 4164:23627 (+ Mobile 4164:23731): the
// labelless `Dropdown` with two `Button` style=White rows (Icon/Globe "Via
// link", Icon/Pencil "Handmatig"). Rendered inside the Plus button's
// `relative` wrapper (CardContainer `addMenu`), positioned like the recipe
// detail overflow menu. Notes: design/notes/AddRecipeMenu.md.
export interface AddRecipeMenuProps {
  open: boolean;
  onClose: () => void;
  onViaLink: () => void;
  onManual: () => void;
}

export function AddRecipeMenu({ open, onClose, onViaLink, onManual }: AddRecipeMenuProps) {
  const t = useTranslations("components.recipeImport.menu");
  const popoverRef = useRef<HTMLDivElement>(null);
  // The positioning hook measures against the trigger wrapper, which is this
  // menu's own parent (CardContainer's `relative` Plus-button wrapper).
  const wrapperRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    wrapperRef.current = popoverRef.current?.parentElement ?? null;
  });
  const position = usePopoverPosition(wrapperRef, popoverRef, { open, anchor: "right", prefer: "below" });

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (isOutsideAllContainers(event.target as Node, [wrapperRef.current])) onClose();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    // `w-[209px]` is the fetched Dropdown's own width (node 4164:23627).
    <div ref={popoverRef} className="absolute z-[999] w-[209px]" style={position.style}>
      <Dropdown className="shadow-sm">
        <Button variant="white" align="left" icon="Globe" onClick={onViaLink}>
          {t("viaLinkLabel")}
        </Button>
        <Button variant="white" align="left" icon="Pencil" onClick={onManual}>
          {t("manualLabel")}
        </Button>
      </Dropdown>
    </div>
  );
}
