import { SettingsPanel } from "./SettingsPanel";

// Harness-only: SidePanel is `position: fixed`, so the wrapper keeps the
// Provider div (the baseline crop) from collapsing. Server actions are stood in
// by .ladle/mocks/profile-actions.ts.
const base = {
  open: true,
  onClose: () => {},
  currentLocale: "nl",
  currentDisplayName: "Jesse",
  currentLastName: "Kamps",
  hasAvatar: false,
} as const;

// "Verbanden en slim zoeken" opt-in (#579): off (default), on, and no provider configured.
export const AiOff = () => (
  <div className="min-h-screen">
    <SettingsPanel {...base} aiEnabled={false} aiAvailable />
  </div>
);

export const AiOn = () => (
  <div className="min-h-screen">
    <SettingsPanel {...base} aiEnabled aiAvailable />
  </div>
);

export const AiUnavailable = () => (
  <div className="min-h-screen">
    <SettingsPanel {...base} aiEnabled={false} aiAvailable={false} />
  </div>
);
