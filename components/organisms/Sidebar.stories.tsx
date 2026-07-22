// figma: node-id=3674:5664
import type { Story } from "@ladle/react";
import { Sidebar, type SidebarItemId } from "./Sidebar";
import en from "../../messages/en.json";
import nl from "../../messages/nl.json";

// The nav/toggle labels ARE user-facing chrome text, so they come from the
// message catalog rather than being typed here directly — same convention
// CardContainer.stories.tsx uses for its own add/edit labels.
const enLabels = en.components.sidebar;
const nlLabels = nl.components.sidebar;

type PlaygroundProps = {
  collapsed: boolean;
  activeItem: SidebarItemId | "none";
};

export const Playground: Story<PlaygroundProps> = ({
  collapsed,
  activeItem,
}) => (
  <div className="flex h-[600px]">
    <Sidebar
      collapsed={collapsed}
      navLabel={enLabels.navLabel}
      toggleLabel={collapsed ? enLabels.expandLabel : enLabels.collapseLabel}
      activeItem={activeItem === "none" ? undefined : activeItem}
      labels={enLabels.items}
      onNavigate={() => {}}
      onToggle={() => {}}
    />
  </div>
);

Playground.args = {
  collapsed: false,
  activeItem: "recipes",
};

Playground.argTypes = {
  collapsed: { control: { type: "boolean" } },
  activeItem: {
    control: { type: "select" },
    options: ["none", "todo", "notes", "recipes", "shopping", "clothes", "assistant"],
  },
};

// The two fetched Collapsed variants side by side, "Recepten" active in
// both — matches the one fetched instance in the node that differs from its
// siblings (see the component's own doc comment for how the active state is
// modelled, and the flagged pixel gap against that one sample).
export const Variants = () => (
  <div className="flex h-[600px] gap-8">
    <Sidebar
      navLabel={enLabels.navLabel}
      toggleLabel={enLabels.collapseLabel}
      activeItem="recipes"
      labels={enLabels.items}
    />
    <Sidebar
      collapsed
      navLabel={enLabels.navLabel}
      toggleLabel={enLabels.expandLabel}
      activeItem="recipes"
      labels={enLabels.items}
    />
  </div>
);

// NL catalog check for the nav/toggle labels.
export const LabelsNl = () => (
  <div className="flex h-[600px]">
    <Sidebar
      navLabel={nlLabels.navLabel}
      toggleLabel={nlLabels.collapseLabel}
      activeItem="recipes"
      labels={nlLabels.items}
    />
  </div>
);
