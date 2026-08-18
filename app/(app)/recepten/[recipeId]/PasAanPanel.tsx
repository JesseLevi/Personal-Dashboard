"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { SidePanel } from "@/components/organisms/SidePanel";
import { Button } from "@/components/atoms/Button";
import { Dropdown } from "@/components/atoms/Dropdown";
import { Card } from "@/components/molecules/Card";
import { PortionStepper } from "@/components/molecules/PortionStepper";
import { usePopoverPosition } from "@/lib/dom/use-popover-position";
import type { UnitSystem } from "@/lib/recipes/units";

// #160 — Figma "Recept/Mobile/PasAan/Dropdown" (pull-up panel 3998:10701) /
// "Recept/Desktop/PasAan/Dropdown" (slide-in panel 3999:10877). Page-level
// composition reusing SidePanel exactly as-is (its existing responsive
// pull-up/slide-in behaviour is the fetched "Slides in from right"
// annotation on 3999:10877 — no second panel primitive built). Not a
// fetched Figma component itself (same non-mapped precedent as
// RecipePanel.tsx/CategoryPanel.tsx) — no figma-map.json entry. Every
// deviation (Personen control, dropped "Verwijderen", session-only draft
// state): design/notes/RecipeDetailPage.md.

export interface PasAanPanelProps {
  open: boolean;
  onClose: () => void;
  /** Currently-applied session values — the panel's own draft resets to these every time it opens. */
  portions: number;
  unitSystem: UnitSystem;
  /** Fired only by "Opslaan" — see design/notes/RecipeDetailPage.md's "session-only" entry. */
  onApply: (portions: number, unitSystem: UnitSystem) => void;
}

export function PasAanPanel({ open, onClose, portions, unitSystem, onApply }: PasAanPanelProps) {
  const t = useTranslations("components.pasAanPanel");
  const tSidePanel = useTranslations("components.sidePanel");
  const tPortion = useTranslations("components.portionStepper");

  const [draftPortions, setDraftPortions] = useState(portions);
  const [draftUnitSystem, setDraftUnitSystem] = useState(unitSystem);
  const [unitMenuOpen, setUnitMenuOpen] = useState(false);
  const unitMenuRef = useRef<HTMLDivElement>(null);
  const unitPopoverRef = useRef<HTMLDivElement>(null);

  // Reset the draft to the applied values on every open, so a prior
  // open-then-close-without-saving (X / overlay / Escape / mobile
  // drag-to-close — SidePanel wires all of those to `onClose`, never to
  // `onApply`) never leaks into the next open.
  useEffect(() => {
    if (open) {
      setDraftPortions(portions);
      setDraftUnitSystem(unitSystem);
      setUnitMenuOpen(false);
    }
  }, [open, portions, unitSystem]);

  useEffect(() => {
    if (!unitMenuOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (unitMenuRef.current && !unitMenuRef.current.contains(event.target as Node)) {
        setUnitMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [unitMenuOpen]);

  // Viewport-aware placement (docs/incidents.md, 2026-08-18) — right-anchored
  // below by design, flips above on SidePanel's mobile sheet where this is
  // the last row and there's no room under it. design/notes/PasAanPanel.md.
  const unitPopover = usePopoverPosition(unitMenuRef, unitPopoverRef, {
    open: unitMenuOpen,
    anchor: "right",
    prefer: "below",
  });

  const unitOptionLabel = draftUnitSystem === "us" ? t("usOption") : t("metricOption");

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={t("title")}
      closeLabel={tSidePanel("closeLabel")}
      footer={
        <Button
          icon="Save"
          onClick={() => {
            onApply(draftPortions, draftUnitSystem);
            onClose();
          }}
        >
          {t("saveLabel")}
        </Button>
      }
    >
      {/* Figma wraps Personen/Eenheid in a titled Card ("Ingrediënten") with
          the same bordered slot every other Card uses — reused directly
          rather than hand-rolling the box. */}
      <Card title={t("ingredientsCardTitle")}>
        <div className="flex w-full items-center justify-between gap-inline-xl border-b border-stroke-lines py-component-md pl-component-md pr-component-md">
          <p className="text-base font-semibold text-text-primary">{t("personenLabel")}</p>
          <PortionStepper
            portions={draftPortions}
            label={tPortion("count", { count: draftPortions })}
            decrementLabel={tPortion("decrementLabel")}
            incrementLabel={tPortion("incrementLabel")}
            onChange={setDraftPortions}
          />
        </div>
        <div ref={unitMenuRef} className="relative flex w-full items-center justify-between gap-inline-xl py-component-md pl-component-md pr-component-md">
          <p className="text-base font-semibold text-text-primary">{t("eenheidLabel")}</p>
          <Button
            trailingIcon="ChevronDown"
            aria-expanded={unitMenuOpen}
            onClick={() => setUnitMenuOpen((open) => !open)}
          >
            {unitOptionLabel}
          </Button>
          {unitMenuOpen && (
            <div ref={unitPopoverRef} className="absolute z-[999] w-40" style={unitPopover.style}>
              <Dropdown className="shadow-sm">
                <Button
                  variant={draftUnitSystem === "us" ? "filled" : "white"}
                  align="left"
                  aria-pressed={draftUnitSystem === "us"}
                  onClick={() => {
                    setDraftUnitSystem("us");
                    setUnitMenuOpen(false);
                  }}
                >
                  {t("usOption")}
                </Button>
                <Button
                  variant={draftUnitSystem === "metric" ? "filled" : "white"}
                  align="left"
                  aria-pressed={draftUnitSystem === "metric"}
                  onClick={() => {
                    setDraftUnitSystem("metric");
                    setUnitMenuOpen(false);
                  }}
                >
                  {t("metricOption")}
                </Button>
              </Dropdown>
            </div>
          )}
        </div>
      </Card>
    </SidePanel>
  );
}
