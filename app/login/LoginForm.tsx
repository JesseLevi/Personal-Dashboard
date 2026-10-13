"use client";

import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { cn } from "@/lib/ui/cn";
import { useTranslations } from "next-intl";
import { InputField } from "@/components/atoms/InputField";
import { Button } from "@/components/atoms/Button";
import { GREETING_LOOKUP_DEBOUNCE_MS, parseGreetingAddress } from "@/lib/auth/greeting-address";
import { blurFadeStagger, blurOutTotalMs, usePrefersReducedMotion } from "@/lib/ui/blur-fade";
import { markEnterFromLogin } from "@/lib/ui/login-enter";
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
const EXIT_TARGET = "/te-doen";
// Heading, password field, button row, magic-link form, then the page's visual (page.tsx
// fades it via `data-exiting`): the top-to-bottom exit order.
const EXIT_ELEMENT_COUNT = 5;
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
  /** Leaves the page after the exit animation; LoginFormClient passes `router.replace`. */
  onNavigate?: (href: string) => void;
  /** Warms the target route while the exit plays; LoginFormClient passes `router.prefetch`. */
  onPrefetch?: (href: string) => void;
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
  onNavigate,
  onPrefetch,
}: LoginFormProps) {
  const t = useTranslations("auth");
  const reducedMotion = usePrefersReducedMotion();

  // The text stays while the name part collapses, so it can animate out.
  const [greetingName, setGreetingName] = useState(initialGreetingName ?? "");
  const [greetingVisible, setGreetingVisible] = useState(Boolean(initialGreetingName));
  const lookupSeq = useRef(0);
  const lookedUpEmail = useRef<string | null>(null);
  const greetingShown = useRef(Boolean(initialGreetingName));
  const debounceTimer = useRef<number | null>(null);
  const { containerRef: turnstileRef, getToken, warm: warmTurnstile } = useTurnstile(turnstileSiteKey);

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

  // Exit: the session cookie is already set when the action returns success.
  const exiting = passwordState.status === "success";
  // React resets the form once the action settles; seeding defaultValue keeps the dots visible while they blur out.
  const [typedPassword, setTypedPassword] = useState("");
  // Latest router callbacks live in a ref: the parent passes fresh inline functions on every
  // render (the sign-in action re-renders this route too), and as effect deps they restarted
  // the exit timer, so the navigation slipped out of step with the animation.
  const routerRef = useRef({ onNavigate, onPrefetch });
  useEffect(() => {
    routerRef.current = { onNavigate, onPrefetch };
  });
  useEffect(() => {
    if (!exiting) return;
    // Close the mobile keyboard now, while the form fades out; closing it on unmount resized
    // the viewport under the entering page.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    routerRef.current.onPrefetch?.(EXIT_TARGET);
    const timer = window.setTimeout(() => {
      markEnterFromLogin();
      routerRef.current.onNavigate?.(EXIT_TARGET);
    }, blurOutTotalMs(EXIT_ELEMENT_COUNT, reducedMotion));
    return () => window.clearTimeout(timer);
  }, [exiting, reducedMotion]);
  const exitClass = (index: number) => (exiting ? ["animate-blur-out", blurFadeStagger(index)] : null);

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

  function clearDebounce() {
    if (debounceTimer.current !== null) {
      window.clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
  }
  useEffect(() => clearDebounce, []);

  function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearDebounce();
    // Format-only, client-side, per #158: no existence check on the address
    // (an "unknown account" error here would make this screen a
    // user-enumeration oracle) — a valid format always proceeds to step 3.
    const address = parseGreetingAddress(new FormData(event.currentTarget).get("email"));
    if (address === null) {
      setEmailError(t("errors.invalid-email-format"));
      return;
    }
    setEmailError(null);
    setEmail(address);
    setStep("password");
    void startGreetingLookup(address);
  }

  // #416: look the name up while typing. Valid + 250ms idle (or blur) starts the
  // lookup; an invalid/empty value does nothing, so the shown name stays while a
  // typo is corrected. Autofill fires onChange too. Dedupe lives in startGreetingLookup.
  function handleEmailChange(event: ChangeEvent<HTMLInputElement>) {
    clearDebounce();
    warmTurnstile();
    const address = parseGreetingAddress(event.target.value);
    if (address === null) return;
    debounceTimer.current = window.setTimeout(() => {
      debounceTimer.current = null;
      void startGreetingLookup(address);
    }, GREETING_LOOKUP_DEBOUNCE_MS);
  }
  function handleEmailBlur(event: FocusEvent<HTMLInputElement>) {
    clearDebounce();
    const address = parseGreetingAddress(event.target.value);
    if (address !== null) void startGreetingLookup(address);
  }

  // The Turnstile token is pre-fetched on focus or the first keystroke (useTurnstile),
  // so getToken() below normally resolves at once. Runs beside the step slide, never delaying it. Same e-mail as the last
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
    <div className="flex w-full flex-col items-center" data-exiting={exiting || undefined}>
      <GreetingHeading
        hey={t("greeting.hey")}
        tail={t("greeting.tail")}
        srText={
          greetingVisible && greetingName !== ""
            ? t("greeting.named", { name: greetingName })
            : t("greeting.plain")
        }
        name={greetingName}
        visible={greetingVisible}
        className={cn(exitClass(0))}
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
                onFocus={warmTurnstile}
                onChange={handleEmailChange}
                onBlur={handleEmailBlur}
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
            <form action={passwordFormAction} inert={exiting}>
              <input type="hidden" name="email" value={email} />
              <InputField
                className={cn(exitClass(1))}
                id={passwordInputId}
                name="password"
                type="password"
                placeholder={t("passwordPlaceholder")}
                autoComplete="current-password"
                defaultValue={exiting ? typedPassword : undefined}
                onChange={(event) => setTypedPassword(event.target.value)}
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
              <div className={cn("mt-4 flex gap-2", exitClass(2))}>
                <Button
                  type="button"
                  variant="outline"
                  icon="ArrowLeft"
                  onClick={handleStepBack}
                  className="flex-1"
                >
                  {t("back")}
                </Button>
                <Button type="submit" disabled={passwordPending || exiting} className="flex-1">
                  {t("signIn")}
                </Button>
              </div>
            </form>

            <form action={magicLinkFormAction} className={cn("mt-4", exitClass(3))} inert={exiting}>
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
// from 0 width (grid 0fr -> 1fr) and reveals from its own centre, so the
// centered row pushes the outer parts apart. The visual row is aria-hidden; the sr-only sentence is the h1's
// accessible name. A long name truncates (min-w-0 + ellipsis) so the row never
// exceeds its column. Record: design/notes/LoginForm.md.
function GreetingHeading({
  hey,
  tail,
  srText,
  name,
  visible,
  className,
}: {
  hey: string;
  tail: string;
  srText: string;
  name: string;
  visible: boolean;
  className?: string;
}) {
  const shown = visible && name !== "";
  // Blur the name in or out only on a change, never on first paint.
  const [wasShown, setWasShown] = useState(shown);
  const [nameMotion, setNameMotion] = useState<"in" | "out" | null>(null);
  // While the name opens or closes it is clipped from its centre; at rest it truncates with an ellipsis.
  const [settled, setSettled] = useState(true);
  if (shown !== wasShown) {
    setWasShown(shown);
    setNameMotion(shown ? "in" : "out");
    setSettled(false);
  }
  useEffect(() => {
    if (settled) return;
    const id = window.setTimeout(() => setSettled(true), GREETING_COLLAPSE_MS + 50);
    return () => window.clearTimeout(id);
  }, [settled, shown]);
  return (
    <h1 className={cn("max-w-full text-xl font-semibold text-text-primary", className)}>
      <span className="sr-only">{srText}</span>
      <span aria-hidden className="flex max-w-full items-baseline justify-center">
        <span className="shrink-0 whitespace-nowrap">{hey}</span>
        <span
          className={cn(
            "grid min-w-0 transition-[grid-template-columns,opacity] duration-[var(--duration-base)] ease-base motion-reduce:transition-none",
            shown ? "grid-cols-[1fr] opacity-100" : "grid-cols-[0fr] opacity-0",
          )}
        >
          <span
            className={cn(
              "flex min-w-0 justify-center overflow-hidden whitespace-pre",
              nameMotion === "in" && "animate-blur-in",
              nameMotion === "out" && "animate-blur-out",
            )}
          >
            <span className={cn(settled ? "min-w-0 overflow-hidden text-ellipsis" : "shrink-0")}>{` ${name}`}</span>
          </span>
        </span>
        <span className="shrink-0 whitespace-nowrap">{tail}</span>
      </span>
    </h1>
  );
}
