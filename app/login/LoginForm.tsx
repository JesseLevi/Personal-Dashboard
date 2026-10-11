"use client";

import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { cn } from "@/lib/ui/cn";
import { useTranslations } from "next-intl";
import { InputField } from "@/components/atoms/InputField";
import { Button } from "@/components/atoms/Button";
import { magicLinkSchema } from "@/lib/auth/schemas";
import type { MagicLinkState, PasswordLoginState } from "./actions";
import { useTurnstile } from "./useTurnstile";

// Login/Mobile+Desktop (3929:25181). StepAnimation (3934:32745): two panes
// share one grid cell and slide by the Figma rail distance (357px). Heading
// name (4221:14843/4221:14891, ADR-0031) opens between "Hey" and the tail.
// Record: design/notes/LoginForm.md.

const PANE_CLASS =
  "col-start-1 row-start-1 transition-[translate] duration-[var(--duration-base)] ease-base motion-reduce:transition-none";

const IDLE_PASSWORD_STATE: PasswordLoginState = { status: "idle" };
const IDLE_MAGIC_LINK_STATE: MagicLinkState = { status: "idle" };

export interface LoginFormProps {
  signInWithPasswordAction: (
    prevState: PasswordLoginState,
    formData: FormData,
  ) => Promise<PasswordLoginState>;
  sendMagicLinkAction: (
    prevState: MagicLinkState,
    formData: FormData,
  ) => Promise<MagicLinkState>;
  /** ADR-0031: first-name lookup for the heading; resolves `{ name: null }` on any failure. */
  lookupGreetingNameAction: (
    email: string,
    turnstileToken: string,
  ) => Promise<{ name: string | null }>;
  /** Turnstile site key (server env, not NEXT_PUBLIC_). Absent = no widget, no lookup. */
  turnstileSiteKey?: string;
  /** Ladle-only: heading name already resolved on mount. */
  initialGreetingName?: string;
  /**
   * Ladle-only: which StepAnimation pane is visible on mount. A real visit
   * always starts at "email" (the default); the Ladle baselines for step 3,
   * the error state and the magic-link-sent state need step 3 reachable
   * without driving a real submission — this prop plus `initialState` below
   * are how the four Figma frames become story-able.
   */
  initialStep?: "email" | "password";
  /** Ladle-only: seeds the two forms' `useActionState` results — see `initialStep`. */
  initialState?: { password?: PasswordLoginState; magicLink?: MagicLinkState };
}

export function LoginForm({
  signInWithPasswordAction,
  sendMagicLinkAction,
  lookupGreetingNameAction,
  turnstileSiteKey,
  initialGreetingName,
  initialStep = "email",
  initialState,
}: LoginFormProps) {
  const t = useTranslations("auth");

  // The text outlives `nameVisible` so the name animates out with its
  // letters still in place; it is only replaced while hidden.
  const [nameText, setNameText] = useState(initialGreetingName ?? "");
  const [nameVisible, setNameVisible] = useState(Boolean(initialGreetingName));
  const lookedUpEmail = useRef<string | null>(null);
  const lookupId = useRef(0);
  const { containerRef: turnstileRef, getToken } = useTurnstile(turnstileSiteKey);

  // Runs beside the step slide, never awaited by it. A stale or failed
  // lookup just leaves the plain greeting; there is no error UI.
  async function startLookup(address: string) {
    const id = ++lookupId.current;
    try {
      const token = await getToken();
      if (!token || id !== lookupId.current) return;
      const { name } = await lookupGreetingNameAction(address, token);
      if (!name || id !== lookupId.current) return;
      setNameText(name);
      setNameVisible(true);
    } catch {
      // fall through: plain greeting
    }
  }

  const [step, setStep] = useState<"email" | "password">(initialStep);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  const [passwordState, passwordFormAction, passwordPending] = useActionState(
    signInWithPasswordAction,
    initialState?.password ?? IDLE_PASSWORD_STATE,
  );
  const [magicLinkState, magicLinkFormAction, magicLinkPending] = useActionState(
    sendMagicLinkAction,
    initialState?.magicLink ?? IDLE_MAGIC_LINK_STATE,
  );

  const emailInputId = useId();
  const passwordInputId = useId();
  const emailErrorId = useId();
  const passwordErrorId = useId();
  const magicLinkErrorId = useId();

  // Focuses the pane that just became active, in either direction — skips
  // the very first render so step 1 isn't auto-focused on a plain page
  // load (only "open step 3" is Figma-annotated behaviour; the reverse
  // direction is this component's own undesigned back affordance, see
  // handleStepBack below, and still needs focus to land somewhere sane).
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const id = step === "password" ? passwordInputId : emailInputId;
    document.getElementById(id)?.focus({ preventScroll: true });
  }, [step, emailInputId, passwordInputId]);

  function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Format-only, client-side, per #158: no existence check on the address
    // (an "unknown account" error here would make this screen a
    // user-enumeration oracle) — a valid format always proceeds to step 3.
    const parsed = magicLinkSchema.safeParse({
      email: new FormData(event.currentTarget).get("email"),
    });
    if (!parsed.success) {
      setEmailError(t("errors.invalid-email-format"));
      return;
    }
    setEmailError(null);
    setEmail(parsed.data.email);
    setStep("password");

    // Same address after Terug keeps the name; a different one clears it
    // (animating out) before the new lookup starts.
    const address = parsed.data.email.trim().toLowerCase();
    if (turnstileSiteKey && lookedUpEmail.current !== address) {
      lookedUpEmail.current = address;
      lookupId.current++;
      setNameVisible(false);
      void startLookup(address);
    }
  }

  // Undesigned (no Figma trigger for "back to email") — Escape plus a
  // small icon-only back button, the least-inventing option that still
  // reaches every input modality. Ratified by the user when they drew the
  // step-3 pane; full record in design/notes/LoginForm.md.
  function handleStepBack() {
    setStep("email");
  }
  function handlePasswordPaneKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      handleStepBack();
    }
  }

  return (
    <div className="flex w-full flex-col items-center">
      {/* "Hey" + [name] + tail as inline parts in a centred row: the name's
          width opens from 0, which pushes "Hey" left and the tail right.
          The leading nbsp is the only space (a regular one would collapse). */}
      <h1
        aria-label={`${t("greeting.lead")}${nameVisible ? ` ${nameText}` : ""}${t("greeting.tail")}`}
        className="text-center text-xl font-semibold text-text-primary"
      >
        <span>{t("greeting.lead")}</span>
        <span
          aria-hidden
          className={cn(
            "inline-grid align-top transition-[grid-template-columns] duration-[var(--duration-base)] ease-base motion-reduce:transition-none",
            nameVisible ? "grid-cols-[1fr]" : "grid-cols-[0fr]",
          )}
        >
          <span
            className={cn(
              "overflow-hidden whitespace-nowrap transition-opacity duration-[var(--duration-base)] ease-base motion-reduce:transition-none",
              nameVisible ? "opacity-100" : "opacity-0",
            )}
          >
            {" "}
            {nameText}
          </span>
        </span>
        <span>{t("greeting.tail")}</span>
      </h1>
      {turnstileSiteKey ? <div ref={turnstileRef} /> : null}

      {/* 16px padding, offset by negative margin + mt (24px - 16px): room for
          focus rings inside the mask's border box, layout unchanged. */}
      <div className="-mx-component-lg -mb-component-lg mt-stack-sm p-component-lg [mask-image:linear-gradient(to_right,transparent,black_var(--spacing-component-lg),black_calc(100%-var(--spacing-component-lg)),transparent)]">
        <div className="grid w-[312px]">
          {/* Step 1 — E-mail (3934:32746) */}
          <div
            className={cn(PANE_CLASS, step === "email" ? "translate-x-0" : "pointer-events-none -translate-x-[357px]")}
            aria-hidden={step !== "email"}
            inert={step !== "email"}
          >
            <form onSubmit={handleEmailSubmit} noValidate>
              <InputField
                id={emailInputId}
                name="email"
                type="email"
                placeholder={t("emailPlaceholder")}
                autoComplete="email"
                aria-invalid={emailError ? true : undefined}
                aria-describedby={emailError ? emailErrorId : undefined}
              />
              <ErrorLine id={emailErrorId} message={emailError} />
              <Button type="submit" className="mt-4 w-full">
                {t("continue")}
              </Button>
            </form>
          </div>

          {/* Step 3 — Wachtwoord (3991:13224, the redrawn Step-03/Error node
              — the Terug/Inloggen row it introduces replaces the plain
              full-width "Inloggen" button unconditionally, not only while
              an error shows) */}
          <div
            className={cn(PANE_CLASS, step === "password" ? "translate-x-0" : "pointer-events-none translate-x-[357px]")}
            aria-hidden={step !== "password"}
            inert={step !== "password"}
            onKeyDown={handlePasswordPaneKeyDown}
          >
            <form action={passwordFormAction}>
              <input type="hidden" name="email" value={email} />
              <InputField
                id={passwordInputId}
                name="password"
                type="password"
                placeholder={t("passwordPlaceholder")}
                autoComplete="current-password"
                required
                aria-invalid={passwordState.status === "error" ? true : undefined}
                aria-describedby={passwordState.status === "error" ? passwordErrorId : undefined}
              />
              <ErrorLine
                id={passwordErrorId}
                message={
                  passwordState.status === "error" ? t(`errors.${passwordState.errorKey}`) : null
                }
              />
              {/* Frame 3 (3991:13289) — Figma draws 153/151px, a hug/
                  rounding artefact (see design/notes/LoginForm.md); equal
                  flex-1 halves is the correct read. */}
              {/* spacing-flag: gap-2 (8px) — measured the fetched "Frame 3"
                  node itself (3991:13289, the Terug/Inloggen row): itemSpacing
                  is 8 but carries no boundVariables entry at all (unbound in
                  Figma) — coincides with both inline-sm and component-sm,
                  exactly the ambiguity this ticket forbids guessing through —
                  design/notes/LoginForm.md#219. */}
              <div className="mt-4 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  icon="ArrowLeft"
                  onClick={handleStepBack}
                  className="flex-1"
                >
                  {t("back")}
                </Button>
                <Button type="submit" disabled={passwordPending} className="flex-1">
                  {t("signIn")}
                </Button>
              </div>
            </form>

            <form action={magicLinkFormAction} className="mt-4">
              <input type="hidden" name="email" value={email} />
              <Button
                type="submit"
                variant="outline"
                icon={magicLinkState.status === "sent" ? "Check" : "Scroll"}
                disabled={magicLinkPending || magicLinkState.status === "sent"}
                className="w-full"
              >
                {magicLinkState.status === "sent" ? t("magicLinkSent") : t("sendMagicLink")}
              </Button>
              <ErrorLine
                id={magicLinkErrorId}
                message={
                  magicLinkState.status === "error" ? t(`errors.${magicLinkState.errorKey}`) : null
                }
              />
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// Collapsible error line (#158 — no Figma frame draws it in the Step-03/
// password shape; the fetched "Error" frame draws this exact 16px-column
// pattern on the Step-01/email pane instead, see design/notes/LoginForm.md).
// grid-rows-[0fr]->[1fr] + the 16px gap living on the line's own margin
// (never the column's gap) so a collapsed line contributes zero space and
// the button below slides down smoothly when it expands — same technique as
// Dropdown.tsx's open/close panel.
function ErrorLine({ id, message }: { id: string; message: string | null }) {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-[var(--duration-base)] ease-base motion-reduce:transition-none",
        message ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
    >
      <div className="overflow-hidden">
        <p
          id={id}
          role="alert"
          className={cn(
            "mt-4 text-center text-base font-semibold text-priority-urgent transition-opacity duration-[var(--duration-base)] ease-base motion-reduce:transition-none",
            message ? "opacity-100" : "opacity-0",
          )}
        >
          {message}
        </p>
      </div>
    </div>
  );
}
