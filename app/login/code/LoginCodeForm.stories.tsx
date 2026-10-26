// design: Claude-designed (#492), see design/notes/LoginForm.md (code step).
import type { ReactNode } from "react";
import Image from "next/image";
import { LoginExitProvider, LoginVisual } from "../LoginExit";
import type { LoginCodeSendState, VerifyLoginCodeState } from "../actions";
import { LoginCodeForm, type LoginCodeFormProps } from "./LoginCodeForm";
import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import type { StoryDefault } from "@ladle/react";

export default { title: "Account / Login code form" } satisfies StoryDefault;

// Dev-only mock actions: the real ones are "use server" and need Supabase and a request.
const mockVerify = async (prev: VerifyLoginCodeState, formData: FormData): Promise<VerifyLoginCodeState> => {
  console.log("verifyLoginCode", prev, Object.fromEntries(formData));
  return { status: "idle" };
};
const mockResend = async (): Promise<LoginCodeSendState> => {
  console.log("resendLoginCode");
  return { status: "sent" };
};
const mockChangeEmail = async () => console.log("changeLoginEmail");

function Form(props: Partial<LoginCodeFormProps>) {
  return (
    <LoginCodeForm
      maskedEmail="j****@example.com"
      verifyLoginCodeAction={mockVerify}
      resendLoginCodeAction={mockResend}
      changeLoginEmailAction={mockChangeEmail}
      {...props}
    />
  );
}

// The same frame app/login/layout.tsx draws; `unoptimized` because Ladle has no image loader.
function PageFrame({ children }: { children: ReactNode }) {
  return (
    <main className="flex h-screen flex-col p-component-lg lg:flex-row lg:gap-page-stack">
      <LoginExitProvider>
        <div className="flex flex-1 flex-col items-center justify-center">{children}</div>
        <LoginVisual
          index={4}
          className="relative aspect-square w-full shrink-0 overflow-hidden rounded-container bg-surface-secondary lg:h-full lg:w-auto"
        >
          <Image src="/login/login-visual-mobile.png" alt="" aria-hidden="true" fill unoptimized className="object-cover lg:hidden" />
          <Image src="/login/login-visual-desktop.png" alt="" aria-hidden="true" fill unoptimized className="hidden object-cover lg:block" />
        </LoginVisual>
      </LoginExitProvider>
    </main>
  );
}

// Fresh from the login step: empty field, resend counting down from 60 s.
export const Default = () => <Form />;

export const PartiallyTyped = () => <Form initialState={{ code: "123" }} />;

export const ResendReady = () => <Form initialCooldownSeconds={0} initialState={{ code: "123" }} />;

export const WrongCode = () => (
  <Form initialState={{ code: "123456", verify: { status: "error", errorKey: "invalid-code" } }} />
);

export const RateLimited = () => (
  <Form initialCooldownSeconds={0} initialState={{ verify: { status: "error", errorKey: "rate-limited" } }} />
);

export const CodeResent = () => <Form initialState={{ resend: { status: "sent" } }} />;

// Watch it: type any 6 digits; the form blurs out and onNavigate logs. Reload to replay.
export const ExitAfterVerify = () => (
  <Form
    verifyLoginCodeAction={async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return { status: "success" };
    }}
    onNavigate={(href) => console.log("navigate", href)}
    onPrefetch={(href) => console.log("prefetch", href)}
  />
);

// Full /login/code composition: frame, form and visual.
export const InPageFrame = () => (
  <PageFrame>
    <Form />
  </PageFrame>
);

export const InPageFrameWrongCode = () => (
  <PageFrame>
    <Form initialState={{ code: "123456", verify: { status: "error", errorKey: "invalid-code" } }} />
  </PageFrame>
);

// The main states side by side. The other stories are edge cases (rate limit, exit animation,
// the full page frame).
export const Overview = () => (
  <div>
    <StoryIntro
      what="Second login step: type the six-digit code from the mail. Resend is locked behind a cooldown."
      note="LoginForm"
    />
    <Specimens>
      <Specimen label="Fresh" hint="Empty field, resend counting down">
        <Default />
      </Specimen>
      <Specimen label="Partially typed" hint="Submit stays disabled until six digits">
        <PartiallyTyped />
      </Specimen>
      <Specimen label="Wrong code" hint="Error under the field">
        <WrongCode />
      </Specimen>
      <Specimen label="Code resent" hint="Confirmation after resend">
        <CodeResent />
      </Specimen>
    </Specimens>
  </div>
);

// Type a code in the real form: 123456 signs in, any other six digits is a wrong code. Resend
// works once the cooldown has run out. Navigation is logged instead of followed.
export const Interactive = () => {
  const [run, setRun] = useState(0);
  const [navigated, setNavigated] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-stack-lg">
      <StoryIntro
        what="Type a code: 123456 signs in, any other six digits shows the error. Resend unlocks after the cooldown. Navigation is logged below instead of followed."
        note="LoginForm"
      />
      <Form
        key={run}
        verifyLoginCodeAction={async (_prev, formData) => {
          await new Promise((resolve) => setTimeout(resolve, 300));
          return formData.get("code") === "123456"
            ? { status: "success" }
            : { status: "error", errorKey: "invalid-code" };
        }}
        onNavigate={(href) => setNavigated(href)}
      />
      <div className="flex flex-col items-start gap-stack-sm">
        <p className="text-xs text-text-secondary">{navigated ? `Navigated to ${navigated}` : "Not navigated yet"}</p>
        <Button
          variant="filled"
          onClick={() => {
            setNavigated(null);
            setRun((current) => current + 1);
          }}
        >
          Start over
        </Button>
      </div>
    </div>
  );
};
