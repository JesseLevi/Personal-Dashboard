"use client";

// design: Claude-designed (#492), record in design/notes/LoginForm.md (code step) and OtpInput.md.
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { OtpInput } from "@/components/atoms/OtpInput";
import { blurFadeStagger, blurOutTotalMs, usePrefersReducedMotion } from "@/lib/ui/blur-fade";
import { cn } from "@/lib/ui/cn";
import { markEnterFromLogin } from "@/lib/ui/login-enter";
import type { LoginCodeSendState, VerifyLoginCodeState } from "../actions";

const SIGNED_IN_TARGET = "/te-doen";
// Heading, description, code field, buttons, then the layout's visual (told via `onExitStart`).
const EXIT_ELEMENT_COUNT = 5;
export const RESEND_COOLDOWN_SECONDS = 60;
const CODE_LENGTH = 6;

const IDLE_VERIFY: VerifyLoginCodeState = { status: "idle" };
const IDLE_RESEND: LoginCodeSendState = { status: "idle" };

export interface LoginCodeFormProps {
  /** Already masked by the server page; the real address never reaches the client. */
  maskedEmail: string;
  verifyLoginCodeAction: (prevState: VerifyLoginCodeState, formData: FormData) => Promise<VerifyLoginCodeState>;
  resendLoginCodeAction: () => Promise<LoginCodeSendState>;
  changeLoginEmailAction: () => Promise<void>;
  onNavigate?: (href: string) => void;
  onPrefetch?: (href: string) => void;
  onExitStart?: () => void;
  /** Ladle-only: seeds the two action results and the typed code. */
  initialState?: { verify?: VerifyLoginCodeState; resend?: LoginCodeSendState; code?: string };
  /** Ladle-only: starts the resend countdown elsewhere than at 60 s (0 = ready to resend). */
  initialCooldownSeconds?: number;
}

export function LoginCodeForm({
  maskedEmail,
  verifyLoginCodeAction,
  resendLoginCodeAction,
  changeLoginEmailAction,
  onNavigate,
  onPrefetch,
  onExitStart,
  initialState,
  initialCooldownSeconds = RESEND_COOLDOWN_SECONDS,
}: LoginCodeFormProps) {
  const t = useTranslations("auth.code");
  const reducedMotion = usePrefersReducedMotion();
  // Frozen at mount: the cookie is cleared on success, so a later re-render would pass "".
  const [shownEmail] = useState(maskedEmail);
  const messageId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState(initialState?.code ?? "");

  // Timestamp-based so a background tab or a throttled timer cannot drift the countdown.
  const [clock, setClock] = useState(() => {
    const now = Date.now();
    return { now, end: now + initialCooldownSeconds * 1000 };
  });
  const remaining = Math.max(0, Math.ceil((clock.end - clock.now) / 1000));
  const counting = remaining > 0;
  useEffect(() => {
    if (!counting) return;
    const id = window.setInterval(() => setClock((c) => ({ ...c, now: Date.now() })), 1000);
    return () => window.clearInterval(id);
  }, [counting]);

  const [verifyState, verifyFormAction, verifyPending] = useActionState(
    async (prev: VerifyLoginCodeState, formData: FormData) => {
      const next = await verifyLoginCodeAction(prev, formData);
      if (next.status === "error") {
        // A wrong code is retyped from scratch.
        setCode("");
        otpRef.current?.focus();
      }
      return next;
    },
    initialState?.verify ?? IDLE_VERIFY,
  );
  const [resendState, resendFormAction, resendPending] = useActionState(
    async () => {
      const next = await resendLoginCodeAction();
      if (next.status === "sent") {
        const now = Date.now();
        setClock({ now, end: now + RESEND_COOLDOWN_SECONDS * 1000 });
        setCode("");
        otpRef.current?.focus();
      }
      return next;
    },
    initialState?.resend ?? IDLE_RESEND,
  );

  // A message belongs to the result that produced it; typing again retires it.
  const [seen, setSeen] = useState<{ verify: VerifyLoginCodeState; resend: LoginCodeSendState }>({
    verify: IDLE_VERIFY,
    resend: IDLE_RESEND,
  });
  const verifyError = verifyState.status === "error" && verifyState !== seen.verify ? verifyState : null;
  const resendError = resendState.status === "error" && resendState !== seen.resend ? resendState : null;
  const resent = resendState.status === "sent" && resendState !== seen.resend;
  const errorMessage = verifyError
    ? t(`errors.${verifyError.errorKey}`)
    : resendError
      ? t(`errors.${resendError.errorKey}`)
      : null;
  const message = errorMessage ?? (resent ? t("resent") : null);

  const exiting = verifyState.status === "success";
  const routerRef = useRef({ onNavigate, onPrefetch, onExitStart });
  useEffect(() => {
    routerRef.current = { onNavigate, onPrefetch, onExitStart };
  });
  useEffect(() => {
    if (!exiting) return;
    // Close the mobile keyboard now, while the form fades out (same as LoginForm).
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    routerRef.current.onExitStart?.();
    routerRef.current.onPrefetch?.(SIGNED_IN_TARGET);
    const timer = window.setTimeout(() => {
      markEnterFromLogin();
      routerRef.current.onNavigate?.(SIGNED_IN_TARGET);
    }, blurOutTotalMs(EXIT_ELEMENT_COUNT, reducedMotion));
    return () => window.clearTimeout(timer);
  }, [exiting, reducedMotion]);

  // Entering blurs in, leaving blurs out, both staggered top to bottom.
  const motion = (index: number) => [exiting ? "animate-blur-out" : "animate-blur-in", blurFadeStagger(index)];

  function handleChange(next: string) {
    setCode(next);
    setSeen({ verify: verifyState, resend: resendState });
  }

  return (
    <div className="flex w-[312px] flex-col items-center">
      <h1 className={cn("text-center text-xl font-semibold text-text-primary", motion(0))}>{t("title")}</h1>
      <p className={cn("mt-stack-sm text-center text-base font-semibold text-text-secondary", motion(1))}>
        {t("description", { email: shownEmail })}
      </p>

      <form ref={formRef} action={verifyFormAction} inert={exiting} className="mt-stack-xl w-full">
        <div className={cn(motion(2))}>
          <OtpInput
            ref={otpRef}
            name="code"
            value={code}
            onChange={handleChange}
            onComplete={() => {
              if (!verifyPending) formRef.current?.requestSubmit();
            }}
            invalid={verifyError !== null}
            disabled={exiting}
            autoFocus
            aria-label={t("codeLabel")}
            aria-describedby={message ? messageId : undefined}
          />
        </div>
        <MessageLine id={messageId} message={message} isError={errorMessage !== null} />
        <div className={cn("mt-stack-lg", motion(3))}>
          <Button type="submit" disabled={verifyPending || exiting || code.length < CODE_LENGTH} className="w-full">
            {t("submit")}
          </Button>
        </div>
      </form>

      <div className={cn("mt-stack-sm flex w-full flex-col gap-stack-sm", motion(3))}>
        <form action={resendFormAction} inert={exiting}>
          <Button type="submit" variant="outline" disabled={counting || resendPending || exiting} className="w-full">
            {counting ? t("resendIn", { seconds: remaining }) : t("resend")}
          </Button>
        </form>
        <form action={changeLoginEmailAction} inert={exiting}>
          <Button type="submit" variant="transparent" icon="ArrowLeft" disabled={exiting} className="w-full">
            {t("otherEmail")}
          </Button>
        </form>
      </div>
    </div>
  );
}

// Same collapsing-line technique as LoginForm's ErrorLine; a confirmation uses the
// secondary text colour and a polite live region instead of an alert.
function MessageLine({ id, message, isError }: { id: string; message: string | null; isError: boolean }) {
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
          role={isError ? "alert" : "status"}
          className={cn(
            "mt-stack-lg text-center text-base font-semibold transition-opacity duration-[var(--duration-base)] ease-base motion-reduce:transition-none",
            isError ? "text-priority-urgent" : "text-text-secondary",
            message ? "opacity-100" : "opacity-0",
          )}
        >
          {message}
        </p>
      </div>
    </div>
  );
}
