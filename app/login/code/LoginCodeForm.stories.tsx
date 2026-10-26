// design: Claude-designed (#492), see design/notes/LoginForm.md (code step).
import type { ReactNode } from "react";
import Image from "next/image";
import { LoginExitProvider, LoginVisual } from "../LoginExit";
import type { LoginCodeSendState, VerifyLoginCodeState } from "../actions";
import { LoginCodeForm, type LoginCodeFormProps } from "./LoginCodeForm";
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
