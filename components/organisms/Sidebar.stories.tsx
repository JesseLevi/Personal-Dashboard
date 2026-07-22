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
// Ticket #86: clicking now slides between the two measured widths
// (`duration-[var(--duration-base)]`/`ease-base`, see the component's own "Motion" doc
// comment) instead of snapping — this story is what demonstrates that, live,
// in Ladle. The slide itself is disabled for `prefers-reduced-motion` users
// (`motion-reduce:transition-none` on the component), which isn't something a
// static story can toggle — it depends on the OS/browser setting, not a
// story control, same as `Dropdown`'s equivalent animation.
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
