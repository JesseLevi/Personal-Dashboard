// figma: node-id=3674:5664
import { useState } from "react";
import { Sidebar } from "./Sidebar";
import en from "../../messages/en.json";
import nl from "../../messages/nl.json";

// Chrome text — sourced from the message catalog, not typed here directly.
const enLabels = en.components.sidebar;
const nlLabels = nl.components.sidebar;

// The two fetched Collapsed variants side by side, "Recepten" active in both.
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

// Exercises the collapse toggle live; `collapsed` here is the story's own
// state, standing in for whatever a real caller persists it in. Reduced
// motion is OS/browser-driven, not something a static story can toggle —
// see design/notes/Sidebar.md.
export const Animated = () => {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="flex h-[600px]">
      <Sidebar
        collapsed={collapsed}
        navLabel={nlLabels.navLabel}
        toggleLabel={
          collapsed ? nlLabels.expandLabel : nlLabels.collapseLabel
        }
        activeItem="recipes"
        labels={nlLabels.items}
        onToggle={() => setCollapsed((prev) => !prev)}
      />
    </div>
  );
};
