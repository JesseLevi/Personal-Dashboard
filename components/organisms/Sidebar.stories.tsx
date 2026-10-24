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
      searchLabel={enLabels.searchLabel}
      accountName="Youri Tukker"
      accountMenuOpen={false}
      accountMenuId="sidebar-story-account-menu-expanded"
      settingsLabel={enLabels.settingsLabel}
      logoutLabel={enLabels.logoutLabel}
    />
    <Sidebar
      collapsed
      navLabel={enLabels.navLabel}
      toggleLabel={enLabels.expandLabel}
      activeItem="recipes"
      labels={enLabels.items}
      searchLabel={enLabels.searchLabel}
      accountName="Youri Tukker"
      accountMenuOpen={false}
      accountMenuId="sidebar-story-account-menu-collapsed"
      settingsLabel={enLabels.settingsLabel}
      logoutLabel={enLabels.logoutLabel}
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
        searchLabel={nlLabels.searchLabel}
        onToggle={() => setCollapsed((prev) => !prev)}
        accountName="Youri Tukker"
        accountMenuOpen={false}
        accountMenuId="sidebar-story-account-menu-animated"
        settingsLabel={nlLabels.settingsLabel}
        logoutLabel={nlLabels.logoutLabel}
      />
    </div>
  );
};

// #265: the account dropdown (Settings/Logout) open, plus a no-name/no-avatar
// account (falls back to the generic label + initials) — a second Sidebar so
// both open panels have room to render without overlapping.
export const AccountMenuOpen = () => {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex h-[600px] gap-40">
      <Sidebar
        navLabel={nlLabels.navLabel}
        toggleLabel={nlLabels.collapseLabel}
        activeItem="notes"
        labels={nlLabels.items}
        searchLabel={nlLabels.searchLabel}
        accountName="Youri Tukker"
        accountMenuOpen={open}
        accountMenuId="sidebar-story-account-menu-open"
        onAccountMenuToggle={() => setOpen((value) => !value)}
        settingsLabel={nlLabels.settingsLabel}
        logoutLabel={nlLabels.logoutLabel}
      />
      <Sidebar
        navLabel={enLabels.navLabel}
        toggleLabel={enLabels.collapseLabel}
        activeItem="notes"
        labels={enLabels.items}
        searchLabel={enLabels.searchLabel}
        accountName={enLabels.accountFallbackName}
        accountMenuOpen={false}
        accountMenuId="sidebar-story-account-menu-fallback"
        settingsLabel={enLabels.settingsLabel}
        logoutLabel={enLabels.logoutLabel}
      />
    </div>
  );
};
