import { useState } from "react";
import { MobileTabBar } from "./MobileTabBar";
import { StoryIntro } from "@/.ladle/story-kit";
import type { StoryDefault } from "@ladle/react";

export default { title: "Basis / Panelen / Mobile tab bar" } satisfies StoryDefault;

const items = [
  { id: "todo", icon: "Columns3", label: "Te doen" },
  { id: "agenda", icon: "Calendar", label: "Agenda" },
  { id: "notes", icon: "Notebook", label: "Notities" },
  { id: "recipes", icon: "FolderClosed", label: "Recepten" },
  { id: "shopping", icon: "ShoppingBasket", label: "Mand" },
] as const;

type Id = (typeof items)[number]["id"];

export const Overview = () => {
  const [active, setActive] = useState<Id>("agenda");
  return (
    <div className="min-h-screen">
      <StoryIntro what="Bottom tab bar on mobile (below md): one tap per module switch; the drawer keeps account, settings and search." note="MobileTabBar" />
      <MobileTabBar navLabel="Modules" items={items} activeItem={active} onNavigate={setActive} className="md:block" />
    </div>
  );
};
