// figma: node-id=3674:5664
import { useState } from "react";
import { Sidebar } from "./Sidebar";
import en from "../../messages/en.json";
import nl from "../../messages/nl.json";

// The nav/toggle labels ARE user-facing chrome text, so they come from the
// message catalog rather than being typed here directly — same convention
// CardContainer.stories.tsx uses for its own add/edit labels.
const enLabels = en.components.sidebar;
const nlLabels = nl.components.sidebar;

// The two fetched Collapsed variants side by side, "Recepten" active in
// both (see the component's own doc comment for how the active/Selected
// state is modelled).
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

// Exercises the collapse toggle end to end (renamed from `LabelsNl`, which
// this still doubles as — the NL catalog check for the nav/toggle labels is
// preserved by keeping it on the NL data). `Sidebar` itself stays a Server
// Component with `collapsed` as a plain prop (see the component's own doc
// comment); the `useState` here is the *story's* concern, standing in for
// whatever a real caller persists the flag in (cookie/localStorage/URL).
// Note this proves the toggle wires up, not that it animates — clicking
// still snaps rather than sliding; see the collapse-animation investigation
// filed as a follow-up issue on #25.
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
