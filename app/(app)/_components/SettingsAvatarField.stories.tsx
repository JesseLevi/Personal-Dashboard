import { SettingsAvatarField } from "./SettingsAvatarField";

// Dev-only: the field is presentational, the panel owns the server actions.
// The photo is an inline SVG data URI so the baseline needs no network.
const PHOTO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="rgb(168,162,158)"/><circle cx="60" cy="48" r="22" fill="rgb(231,229,228)"/><ellipse cx="60" cy="112" rx="40" ry="32" fill="rgb(231,229,228)"/></svg>',
  );

const noop = () => {};

export const WithoutPhoto = () => (
  <div className="w-80 p-4">
    <SettingsAvatarField name="Anna" src={null} pending={false} onSelectFile={noop} onRemove={noop} />
  </div>
);

export const WithPhoto = () => (
  <div className="w-80 p-4">
    <SettingsAvatarField name="Anna" src={PHOTO} pending={false} onSelectFile={noop} onRemove={noop} />
  </div>
);

export const Uploading = () => (
  <div className="w-80 p-4">
    <SettingsAvatarField name="Anna" src={PHOTO} pending onSelectFile={noop} onRemove={noop} />
  </div>
);

export const WithError = () => (
  <div className="w-80 p-4">
    <SettingsAvatarField
      name="Anna"
      src={null}
      pending={false}
      error="Dit bestand is te groot (maximaal 5 MB)."
      onSelectFile={noop}
      onRemove={noop}
    />
  </div>
);
