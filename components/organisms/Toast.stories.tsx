import { Toast } from "./Toast";

const noop = () => {};

// Static: stays on screen so the baseline is deterministic.
export const Visible = () => <Toast message="Gedeeld met Youri" onDismiss={noop} durationMs={Infinity} />;
