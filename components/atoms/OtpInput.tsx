"use client";

// design: Claude-designed (#492)
import { OTPInput, REGEXP_ONLY_DIGITS, type SlotProps } from "input-otp";
import type { Ref } from "react";
import { cn } from "@/lib/ui/cn";

/**
 * Atom/OtpInput — six-slot one-time code field around `input-otp`. Slot
 * styling mirrors InputField's box; record: `design/notes/OtpInput.md`.
 */
export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Fires once every slot is filled (paste and OS autofill included). */
  onComplete?: (value: string) => void;
  /** Number of slots; the digits-only pattern is fixed. */
  length?: number;
  /** Name of the real `<input>`, so the code submits with the surrounding form. */
  name?: string;
  disabled?: boolean;
  /** Draws the slots in the error colour; the caller renders the message and wires `aria-describedby`. */
  invalid?: boolean;
  autoFocus?: boolean;
  "aria-label": string;
  "aria-describedby"?: string;
  className?: string;
  ref?: Ref<HTMLInputElement>;
}

function Slot({ char, isActive, hasFakeCaret, invalid, disabled }: SlotProps & { invalid: boolean; disabled: boolean }) {
  return (
    <div
      className={cn(
        "relative flex h-12 min-w-0 flex-1 items-center justify-center rounded-control-outer border border-stroke-primary bg-surface-highlight-white text-base font-semibold text-text-primary transition-colors",
        isActive && !invalid && "border-stroke-primary-selected",
        invalid && "border-priority-urgent text-priority-urgent",
        disabled && "opacity-50",
      )}
    >
      {char}
      {hasFakeCaret ? (
        <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="h-5 w-px animate-breathe bg-text-primary motion-reduce:animate-none" />
        </span>
      ) : null}
    </div>
  );
}

export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  name,
  disabled = false,
  invalid = false,
  autoFocus,
  className,
  ref,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: OtpInputProps) {
  return (
    <OTPInput
      ref={ref}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      maxLength={length}
      pattern={REGEXP_ONLY_DIGITS}
      name={name}
      disabled={disabled}
      autoFocus={autoFocus}
      inputMode="numeric"
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-invalid={invalid ? true : undefined}
      containerClassName={cn("flex w-full gap-inline-sm has-[:disabled]:cursor-not-allowed", className)}
      render={({ slots }) => (
        <>
          {slots.map((slot, index) => (
            <Slot key={index} {...slot} invalid={invalid} disabled={disabled} />
          ))}
        </>
      )}
    />
  );
}
