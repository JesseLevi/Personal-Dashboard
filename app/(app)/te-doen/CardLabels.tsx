"use client";

import { useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { Dropdown } from "@/components/atoms/Dropdown";
import { Icon } from "@/components/atoms/Icon";
import { InputField } from "@/components/atoms/InputField";
import { Tag } from "@/components/atoms/Tag";
import {
  LABELS_PER_CARD,
  LABEL_MAX_LENGTH,
  addLabels,
  filterLabelOptions,
  labelOptions,
  removeLabel,
  resolveFilterEnter,
  toggleLabel,
  type LabelEdit,
} from "@/lib/boards/labels";

// The "Labels" field of CardDetailPanel (ADR-0052): chips for the card's labels and a Dropdown that
// picks from the board's labels or creates one. Composition of existing atoms; the pure rules live in
// lib/boards/labels.ts. Contract: design/notes/CardDetailPanel.md.

const FIELD_ID = "card-detail-labels";
const TRIGGER_ID = `${FIELD_ID}-trigger`;
const FILTER_ID = `${FIELD_ID}-filter`;
// Dropdown's rest-list collapses over 200 ms; scroll the list into view once it has grown.
const OPEN_SETTLE_MS = 220;

export interface CardLabelsProps {
  /** The card's labels, by name. */
  labels: string[];
  onChange: (labels: string[]) => void;
  /** Names of the labels the board already uses. */
  boardLabels: readonly string[];
}

export function CardLabels({ labels, onChange, boardLabels }: CardLabelsProps) {
  const t = useTranslations("components.cardDetailPanel");
  const [query, setQuery] = useState("");
  const [hint, setHint] = useState<LabelEdit["error"]>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const options = labelOptions(boardLabels, labels);
  const visible = filterLabelOptions(options, query);
  const typed = query.trim();
  const hasExactMatch = typed !== "" && options.some((name) => name.toLocaleLowerCase() === typed.toLocaleLowerCase());

  function apply(edit: LabelEdit, clearQuery: boolean) {
    setHint(edit.error);
    if (edit.error) return;
    onChange(edit.labels);
    if (clearQuery) setQuery("");
  }

  function focusFilter() {
    document.getElementById(FILTER_ID)?.focus();
  }

  function handleCreate() {
    if (typed === "") {
      focusFilter();
      return;
    }
    apply(addLabels(labels, query, options), true);
    focusFilter();
  }

  function handleFilterKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    const action = resolveFilterEnter(options, query);
    if (action.kind === "pick") apply(addLabels(labels, action.name, options), true);
    else if (action.kind === "create") apply(addLabels(labels, query, options), true);
  }

  // Arrow keys walk filter -> options -> "Nieuw label"; ArrowDown on the open trigger enters the list and
  // ArrowUp on the first item returns to it. Escape belongs to Dropdown (closes, focus back on the trigger).
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const target = event.target as HTMLElement;
    const trigger = document.getElementById(TRIGGER_ID);
    const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>("input, button") ?? []);
    if (target === trigger) {
      if (event.key === "ArrowDown" && trigger?.getAttribute("aria-expanded") === "true") {
        event.preventDefault();
        items[0]?.focus();
      }
      return;
    }
    const index = items.indexOf(target);
    if (index === -1) return;
    event.preventDefault();
    if (event.key === "ArrowDown") items[Math.min(index + 1, items.length - 1)]?.focus();
    else if (index === 0) trigger?.focus();
    else items[index - 1]?.focus();
  }

  function handleTriggerClick(event: MouseEvent<HTMLDivElement>) {
    const trigger = document.getElementById(TRIGGER_ID);
    if (!trigger || !trigger.contains(event.target as Node)) return;
    setTimeout(() => {
      if (trigger.getAttribute("aria-expanded") === "true") listRef.current?.scrollIntoView({ block: "nearest" });
    }, OPEN_SETTLE_MS);
  }

  return (
    <div className="flex flex-col gap-stack-sm" onKeyDown={handleKeyDown} onClick={handleTriggerClick}>
      <Dropdown label={t("fields.labelsLabel")} id={FIELD_ID} defaultOpen={false}>
        <Button presentational variant="filled" icon="Tag" align="left">
          {t("fields.labelsPlaceholder")}
        </Button>
        <div ref={listRef} role="group" aria-label={t("labels.listLabel")} className="flex flex-col gap-inline-xs">
          <InputField
            id={FILTER_ID}
            aria-label={t("labels.filterLabel")}
            leadingIcon="Search"
            placeholder={t("labels.filterPlaceholder")}
            autoComplete="off"
            maxLength={LABEL_MAX_LENGTH}
            enterKeyHint="done"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleFilterKeyDown}
          />
          {options.length === 0 && typed === "" && <p className="px-component-sm text-sm text-text-secondary">{t("labels.emptyHint")}</p>}
          {visible.length > 0 && (
            <div className="flex max-h-60 flex-col gap-inline-xs overflow-y-auto">
              {visible.map((name) => {
                const selected = labels.some((current) => current.toLocaleLowerCase() === name.toLocaleLowerCase());
                return (
                  <Button
                    key={name.toLocaleLowerCase()}
                    variant={selected ? "filled" : "white"}
                    icon="Tag"
                    trailingIcon={selected ? "Check" : undefined}
                    align="left"
                    aria-pressed={selected}
                    onClick={() => apply(toggleLabel(labels, name), false)}
                  >
                    {name}
                  </Button>
                );
              })}
            </div>
          )}
          {!hasExactMatch && (
            <Button variant="outline" icon="Plus" align="left" onClick={handleCreate}>
              {typed === "" ? t("labels.newLabel") : t("labels.newLabelNamed", { name: typed })}
            </Button>
          )}
        </div>
      </Dropdown>
      {hint && (
        <p role="status" className="text-sm text-text-secondary">
          {hint === "limit" ? t("labels.limitHint", { max: LABELS_PER_CARD }) : t("labels.tooLongHint", { max: LABEL_MAX_LENGTH })}
        </p>
      )}
      {labels.length > 0 && (
        <ul className="flex flex-wrap gap-x-inline-xs">
          {labels.map((name) => (
            <li key={name.toLocaleLowerCase()}>
              <button
                type="button"
                aria-label={t("labels.removeLabel", { name })}
                onClick={() => {
                  setHint(null);
                  onChange(removeLabel(labels, name));
                }}
                // A 40 px tap target around the 24 px chip, the metrics of a Button row.
                className="group flex h-10 cursor-pointer items-center"
              >
                <Tag variant="neutral" icon="Tag" className="transition-colors group-hover:bg-surface-secondary-hover">
                  {name}
                  <Icon name="X" size={14} />
                </Tag>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
