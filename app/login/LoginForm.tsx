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
import { useTurnstile } from "./useTurnstile";
import type { MagicLinkState, PasswordLoginState } from "./actions";

// figma: Login/Mobile+Desktop (3929:25181); StepAnimation (3934:32745);
// heading Step-01 4221:14845 "Hey, welkom bij Atlas" / Step-02 4221:14940
// "Hey Carlotta, welkom bij Atlas". Panes share one grid cell and slide by
// 357px; the heading's name part opens its width in place (GreetingHeading).
// Record: design/notes/LoginForm.md.

const PANE_CLASS =
  "col-start-1 row-start-1 transition-[translate] duration-[var(--duration-base)] ease-base motion-reduce:transition-none";

// Matches --duration-base (200ms) plus a frame of slack.
const GREETING_COLLAPSE_MS = 250;
const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

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
  /** Server action returning the first name for a valid e-mail (ADR-0031); a prop so Ladle can mock it. */
  lookupGreetingNameAction: (input: {
    email: string;
    turnstileToken: string | null;
  }) => Promise<{ name: string | null }>;
  /** Turnstile site key, read server-side by page.tsx; absent = no widget, null token. */
  turnstileSiteKey?: string | null;
  /** Ladle-only: a name already shown in the heading on mount. */
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
  turnstileSiteKey = null,
  initialGreetingName,
  initialStep = "email",
  initialState,
}: LoginFormProps) {
  const t = useTranslations("auth");

  // The text stays while the name part collapses, so it can animate out.
  const [greetingName, setGreetingName] = useState(initialGreetingName ?? "");
  const [greetingVisible, setGreetingVisible] = useState(Boolean(initialGreetingName));
  const lookupSeq = useRef(0);
  const lookedUpEmail = useRef<string | null>(null);
  const greetingShown = useRef(Boolean(initialGreetingName));
  const { containerRef: turnstileRef, getToken } = useTurnstile(turnstileSiteKey);

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
    void startGreetingLookup(parsed.data.email);
  }

  // Runs beside the step slide, never delaying it. Same e-mail as the last
  // lookup keeps the name and skips the query; a different one collapses the
  // old name first. Stale responses (older seq) are dropped; null/throw = plain greeting.
  async function startGreetingLookup(address: string) {
    if (address === lookedUpEmail.current) return;
    lookedUpEmail.current = address;
    const seq = ++lookupSeq.current;
    const hadName = greetingShown.current;
    if (hadName) {
      greetingShown.current = false;
      setGreetingVisible(false);
    }
    try {
      const [token] = await Promise.all([getToken(), hadName ? wait(GREETING_COLLAPSE_MS) : null]);
      const { name } = await lookupGreetingNameAction({ email: address, turnstileToken: token });
      if (seq !== lookupSeq.current || !name) return;
      setGreetingName(name);
      setGreetingVisible(true);
      greetingShown.current = true;
    } catch {
      // plain greeting stays
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
      <GreetingHeading
        hey={t("greeting.hey")}
        tail={t("greeting.tail")}
        name={greetingName}
        visible={greetingVisible}
      />
      <div ref={turnstileRef} aria-hidden className="absolute size-0 overflow-hidden" />

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

// Three inline parts in a centered row: Hey | name | tail. The name part opens
// from 0 width (grid 0fr -> 1fr), so the centered row pushes the outer parts
// apart. The visual row is aria-hidden; the sr-only sentence is the h1's
// accessible name. A long name truncates (min-w-0 + ellipsis) so the row never
// exceeds its column. Record: design/notes/LoginForm.md.
function GreetingHeading({
  hey,
  tail,
  name,
  visible,
}: {
  hey: string;
  tail: string;
  name: string;
  visible: boolean;
}) {
  const shown = visible && name !== "";
  return (
    <h1 className="max-w-full text-xl font-semibold text-text-primary">
      <span className="sr-only">{`${hey}${shown ? ` ${name}` : ""}${tail}`}</span>
      <span aria-hidden className="flex max-w-full items-baseline justify-center">
        <span className="shrink-0 whitespace-nowrap">{hey}</span>
        <span
          className={cn(
            "grid min-w-0 transition-[grid-template-columns,opacity] duration-[var(--duration-base)] ease-base motion-reduce:transition-none",
            shown ? "grid-cols-[1fr] opacity-100" : "grid-cols-[0fr] opacity-0",
          )}
        >
          <span className="overflow-hidden text-ellipsis whitespace-pre">{` ${name}`}</span>
        </span>
        <span className="shrink-0 whitespace-nowrap">{tail}</span>
      </span>
    </h1>
  );
}
