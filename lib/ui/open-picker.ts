const PICKER_TYPES = new Set(["date", "time", "datetime-local", "month", "week"]);

type PickerInput = { type: string; readOnly?: boolean; disabled?: boolean; showPicker?: () => void };

/** Whether a native input of this `type` has a picker that `showPicker()` can open. */
export function hasNativePicker(type: string | undefined): boolean {
  return type !== undefined && PICKER_TYPES.has(type);
}

/** Opens the native picker of a date/time input from a click anywhere in it; where `showPicker` is missing or throws, the default behaviour stays. */
export function openPicker(input: PickerInput): void {
  if (!hasNativePicker(input.type) || input.readOnly || input.disabled) return;
  try {
    input.showPicker?.();
  } catch {
    // Unsupported, or the browser refused (no user activation): keep the default.
  }
}
