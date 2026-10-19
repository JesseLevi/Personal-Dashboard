"use client";

import { openPicker } from "@/lib/ui/open-picker";
import type { InputHTMLAttributes } from "react";

/** The `<input>` of an `InputField` of type date/time: a click anywhere opens the native picker. */
export function InputFieldPickerInput({ onClick, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      onClick={(event) => {
        onClick?.(event);
        openPicker(event.currentTarget);
      }}
    />
  );
}
