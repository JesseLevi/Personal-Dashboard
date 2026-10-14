"use client";

// design: Claude-designed (#487)
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AGENDA_TRAY_ATTRIBUTE } from "@/lib/ui/agenda-calendar";
import { cn } from "@/lib/ui/cn";
import { ButtonToggle } from "../molecules/ButtonToggle";

export type PlanDrawerTab = "recipes" | "cards";

export interface PlanDrawerProps {
  /** Content of the "Recepten" tab. */
  recipes: ReactNode;
  /** Content of the "Kaarten" tab. Omitted: the tab shows an empty state. */
  cards?: ReactNode;
  defaultTab?: PlanDrawerTab;
  className?: string;
}

/**
 * Organism/PlanDrawer — the tray beside (desktop) or under (mobile) the Agenda
 * that holds what can be dragged onto a day. One shell with two tabs; each
 * tab's list is supplied by the caller. Contract: design/notes/PlanDrawer.md.
 */
export function PlanDrawer({ recipes, cards, defaultTab = "recipes", className }: PlanDrawerProps) {
  const t = useTranslations("components.planDrawer");
  const [tab, setTab] = useState<PlanDrawerTab>(defaultTab);

  return (
    <section
      aria-label={t("label")}
      {...{ [AGENDA_TRAY_ATTRIBUTE]: "" }}
      className={cn(
        "flex min-h-0 flex-col gap-stack-md rounded-card border border-stroke-primary bg-surface-highlight-white p-component-sm",
        className,
      )}
    >
      <ButtonToggle
        aria-label={t("tabsLabel")}
        defaultValue={defaultTab}
        items={[
          { value: "recipes", icon: "CookingPot", label: t("tabs.recipes") },
          { value: "cards", icon: "Columns3", label: t("tabs.cards") },
        ]}
        onValueChange={(value) => setTab(value as PlanDrawerTab)}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-stack-sm overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {tab === "recipes" && recipes}
        {tab === "cards" &&
          (cards ?? <p className="text-base font-semibold text-text-secondary">{t("cardsEmpty")}</p>)}
      </div>
    </section>
  );
}
