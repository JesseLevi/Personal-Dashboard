import { Toast } from "./Toast";
import type { StoryDefault } from "@ladle/react";

export default { title: "Basis / Panelen / Toast" } satisfies StoryDefault;

const noop = () => {};

// Static: stays on screen so the baseline is deterministic.
export const Visible = () => <Toast message="Gedeeld met Youri" onDismiss={noop} durationMs={Infinity} />;
