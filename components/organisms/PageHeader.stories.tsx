// figma: node-id=3878:7959
import { useState } from "react";
import { Button } from "../atoms/Button";
import { PageHeader } from "./PageHeader";
import en from "../../messages/en.json";

const t = en.components.pageHeader;

// Te-Doen: chevron (board switcher) + star (favourite) next to the title,
// sort button on the right.
export const TeDoen = () => (
  <PageHeader
    title="Te doen"
    titleAdornments={
      <>
        <Button icon="ChevronDown" aria-label={t.todo.boardSwitcherLabel} />
        <Button icon="Star" aria-label={t.todo.favoriteLabel} />
      </>
    }
    actions={
      <Button icon="ArrowUpDown" aria-label={t.todo.sortLabel}>
        <span className="hidden md:inline">{t.todo.sortLabel}</span>
      </Button>
    }
  />
);

// Recepten: no title adornments, a single "Category" action on the right.
export const Recepten = () => (
  <PageHeader
    title={en.nav.recipes}
    actions={<Button icon="Plus">{t.recipes.addCategoryLabel}</Button>}
  />
);

// Title change: the adornments glide while the name blurs from one to the other.
export const TitleChange = () => {
  const [title, setTitle] = useState("Te doen");
  return (
    <PageHeader
      title={title}
      titleAdornments={
        <>
          <Button
            icon="ChevronDown"
            aria-label={t.todo.boardSwitcherLabel}
            onClick={() => setTitle((current) => (current === "Te doen" ? "Boodschappen en klusjes" : "Te doen"))}
          />
          <Button icon="Star" aria-label={t.todo.favoriteLabel} />
        </>
      }
      actions={
      <Button icon="ArrowUpDown" aria-label={t.todo.sortLabel}>
        <span className="hidden md:inline">{t.todo.sortLabel}</span>
      </Button>
    }
    />
  );
};
