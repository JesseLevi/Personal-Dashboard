"use client";

import { cn } from "@/lib/ui/cn";
import { openPicker } from "@/lib/ui/open-picker";
import type { InputHTMLAttributes } from "react";

/** The `<input>` of an `InputField` of type date/time: a click anywhere opens the native picker. */
export function InputFieldPickerInput({ onClick, className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      // Only our leading icon shows; the click handler below still opens the picker.
      className={cn("[&::-webkit-calendar-picker-indicator]:hidden", className)}
      onClick={(event) => {
        onClick?.(event);
        openPicker(event.currentTarget);
      }}
    />
  );
}
