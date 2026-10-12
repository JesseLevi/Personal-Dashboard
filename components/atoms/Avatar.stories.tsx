// figma: node-id=4231:16053
import { Avatar } from "./Avatar";

// Dev-only demo data. The image is an inline SVG data URI (no network in visual tests).
const IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><rect width='40' height='40' fill='gray'/><circle cx='20' cy='16' r='7' fill='white'/><rect x='8' y='26' width='24' height='14' rx='7' fill='white'/></svg>";

export const WithInitials = () => (
  <div className="flex items-center gap-4">
    <Avatar name="Jesse Kamps" size="md" />
    <Avatar name="Jesse Kamps" size="sm" />
  </div>
);

export const WithImage = () => (
  <div className="flex items-center gap-4">
    <Avatar name="Jesse Kamps" avatarUrl={IMAGE} size="md" />
    <Avatar name="Jesse Kamps" avatarUrl={IMAGE} size="sm" />
  </div>
);
