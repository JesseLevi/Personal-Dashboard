// figma: node-id=3878:7959
import { useState } from "react";
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import { Button } from "../atoms/Button";
import { PageHeader } from "./PageHeader";
import en from "../../messages/en.json";
import type { Story, StoryDefault } from "@ladle/react";

export default { title: "Basis / Panelen / Page header" } satisfies StoryDefault;

const t = en.components.pageHeader;

const SortButton = () => (
  <Button icon="ArrowUpDown" aria-label={t.todo.sortLabel}>
    <span className="hidden md:inline">{t.todo.sortLabel}</span>
  </Button>
);

const todoAdornments = (
  <>
    <Button icon="ChevronDown" aria-label={t.todo.boardSwitcherLabel} />
    <Button icon="Star" aria-label={t.todo.favoriteLabel} />
  </>
);

export const Overview = () => (
  <>
    <StoryIntro what="The page title row: title, optional buttons next to it, actions on the right." note="PageHeader" />
    <Specimens>
      <Specimen label="Te doen" hint="board switcher + favourite next to the title, sort on the right">
        <div className="w-[640px] max-w-full">
          <PageHeader title="Te doen" titleAdornments={todoAdornments} actions={<SortButton />} />
        </div>
      </Specimen>
      <Specimen label="Recepten" hint="no adornments, one action on the right">
        <div className="w-[640px] max-w-full">
          <PageHeader title={en.nav.recipes} actions={<Button icon="Plus">{t.recipes.addCategoryLabel}</Button>} />
        </div>
      </Specimen>
    </Specimens>
  </>
);

type PlaygroundProps = { title: string; titlePending: boolean; withAdornments: boolean; withAction: boolean };

export const Playground: Story<PlaygroundProps> = ({ title, titlePending, withAdornments, withAction }) => (
  <PageHeader
    title={title}
    titlePending={titlePending}
    titleAdornments={withAdornments ? todoAdornments : undefined}
    actions={withAction ? <SortButton /> : undefined}
  />
);
Playground.args = { title: "Te doen", titlePending: false, withAdornments: true, withAction: true };
Playground.argTypes = {
  title: { control: { type: "text" } },
  titlePending: { control: { type: "boolean" } },
  withAdornments: { control: { type: "boolean" } },
  withAction: { control: { type: "boolean" } },
};

// Press the chevron: the adornments glide while the name blurs from one title to the other.
export const Interactive = () => {
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
      actions={<SortButton />}
    />
  );
};
