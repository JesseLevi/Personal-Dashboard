// figma: node-id=3674:5664
import { useState } from "react";
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import { Sidebar, type SidebarItemId } from "./Sidebar";
import en from "../../messages/en.json";
import nl from "../../messages/nl.json";
import type { Story, StoryDefault } from "@ladle/react";

export default { title: "Basis / Panelen / Sidebar" } satisfies StoryDefault;

// Chrome text — sourced from the message catalog, not typed here directly.
const enLabels = en.components.sidebar;
const nlLabels = nl.components.sidebar;

export const Overview = () => (
  <>
    <StoryIntro what="The app's left navigation: modules, search and the account menu; expanded or collapsed." note="Sidebar" />
    <Specimens>
      <Specimen label="expanded" hint="Recepten active">
        <div className="flex h-[600px]">
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
        </div>
      </Specimen>
      <Specimen label="collapsed" hint="icons only">
        <div className="flex h-[600px]">
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
      </Specimen>
    </Specimens>
  </>
);

type PlaygroundProps = { collapsed: boolean; activeItem: SidebarItemId; accountName: string; accountMenuOpen: boolean };

export const Playground: Story<PlaygroundProps> = ({ collapsed, activeItem, accountName, accountMenuOpen }) => (
  <div className="flex h-[600px]">
    <Sidebar
      collapsed={collapsed}
      navLabel={enLabels.navLabel}
      toggleLabel={collapsed ? enLabels.expandLabel : enLabels.collapseLabel}
      activeItem={activeItem}
      labels={enLabels.items}
      searchLabel={enLabels.searchLabel}
      accountName={accountName}
      accountMenuOpen={accountMenuOpen}
      accountMenuId="sidebar-story-account-menu-playground"
      settingsLabel={enLabels.settingsLabel}
      logoutLabel={enLabels.logoutLabel}
    />
  </div>
);
Playground.args = { collapsed: false, activeItem: "recipes", accountName: "Youri Tukker", accountMenuOpen: false };
Playground.argTypes = {
  collapsed: { control: { type: "boolean" } },
  activeItem: { control: { type: "select" }, options: ["todo", "agenda", "notes", "recipes", "shopping", "assistant"] },
  accountName: { control: { type: "text" } },
  accountMenuOpen: { control: { type: "boolean" } },
};

// Click the toggle to collapse and expand; `collapsed` is the story's own state, standing in
// for whatever a real caller persists. Reduced motion is OS-driven (design/notes/Sidebar.md).
export const Interactive = () => {
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
