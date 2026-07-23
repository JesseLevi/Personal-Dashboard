// figma: node-id=3878:7959
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
    actions={<Button icon="ArrowUpDown">{t.todo.sortLabel}</Button>}
  />
);

// Recepten: no title adornments, a single "Category" action on the right.
export const Recepten = () => (
  <PageHeader
    title={en.nav.recipes}
    actions={<Button icon="Plus">{t.recipes.addCategoryLabel}</Button>}
  />
);
