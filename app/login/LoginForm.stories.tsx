// figma: node-id=4221:14843 (Step-01), 4221:14891 (Step-02, heading with name),
// 3933:32343 (Step-03), 3985:10266 (Error), 3989:13128 (InloglinkSend),
// 3991:13224 (Step-03/Error) — see design/notes/LoginForm.md.
import { LoginForm } from "./LoginForm";
import type { LoginCodeSendState, PasswordLoginState } from "./actions";
import type { StoryDefault } from "@ladle/react";

export default { title: "Account / Login form" } satisfies StoryDefault;

// Dev-only mock actions — LoginForm never imports the real "use server"
// module itself (same precedent as CategoryPanel.stories.tsx): the composer
// (app/login/page.tsx) passes the real actions as props so these stand in
// for signInWithPassword/sendLoginCode without needing Supabase/Next's
// request context. Never resolve for real — `initialStep`/`initialState`
// put each story straight into the state it needs to show.
async function mockSignInWithPassword(
  prevState: PasswordLoginState,
  formData: FormData,
): Promise<PasswordLoginState> {
  console.log("signInWithPassword", prevState, Object.fromEntries(formData));
  return { status: "idle" };
}
async function mockSendLoginCode(
  prevState: LoginCodeSendState,
  formData: FormData,
): Promise<LoginCodeSendState> {
  console.log("sendLoginCode", prevState, Object.fromEntries(formData));
  return { status: "idle" };
}

// Mock for the greeting-lookup server action (ADR-0031): resolves after `ms`.
const mockLookupGreetingName = (name: string | null, ms = 0) =>
  async (input: { email: string; turnstileToken: string | null }) => {
    console.log("lookupGreetingName", input);
    await new Promise((resolve) => setTimeout(resolve, ms));
    return { name };
  };

// LogIn/Mobile/Step-01 (4221:14843) — first load, plain heading.
export const Step1Email = () => (
  <LoginForm
    signInWithPasswordAction={mockSignInWithPassword}
    sendLoginCodeAction={mockSendLoginCode}
    lookupGreetingNameAction={mockLookupGreetingName(null)}
  />
);

// LogIn/Mobile/Step-02 (4221:14891) — heading with the resolved first name.
// Seeded straight into the password pane, as the frame shows no Terug.
export const Step2GreetingName = () => (
  <LoginForm
    signInWithPasswordAction={mockSignInWithPassword}
    sendLoginCodeAction={mockSendLoginCode}
    lookupGreetingNameAction={mockLookupGreetingName("Carlotta")}
    initialStep="password"
    initialGreetingName="Carlotta"
  />
);

// Watch the animation: submit a valid e-mail; "Carlotta" arrives after ~600ms.
export const GreetingNameArrivesLate = () => (
  <LoginForm
    signInWithPasswordAction={mockSignInWithPassword}
    sendLoginCodeAction={mockSendLoginCode}
    lookupGreetingNameAction={mockLookupGreetingName("Carlotta", 600)}
  />
);

// #416: type a valid e-mail (no submit): "Carlotta" resolves ~600ms after typing
// stops. Every lookup call is recorded on window.__greetingLookups for the browser check.
const spyLookup = mockLookupGreetingName("Carlotta", 600);
export const GreetingWhileTyping = () => (
  <LoginForm
    signInWithPasswordAction={mockSignInWithPassword}
    sendLoginCodeAction={mockSendLoginCode}
    lookupGreetingNameAction={async (input) => {
      const w = window as unknown as { __greetingLookups?: string[] };
      (w.__greetingLookups ??= []).push(input.email);
      return spyLookup(input);
    }}
  />
);

// Long name: the heading truncates instead of overflowing its column.
export const GreetingLongName = () => (
  <LoginForm
    signInWithPasswordAction={mockSignInWithPassword}
    sendLoginCodeAction={mockSendLoginCode}
    lookupGreetingNameAction={mockLookupGreetingName("Maximiliaan-Alexandrina")}
    initialStep="password"
    initialGreetingName="Maximiliaan-Alexandrina"
  />
);

// LogIn/Mobile/Step-03 (3933:32343) — password pane, idle.
export const Step3Password = () => (
  <LoginForm
    signInWithPasswordAction={mockSignInWithPassword}
    sendLoginCodeAction={mockSendLoginCode}
    lookupGreetingNameAction={mockLookupGreetingName(null)}
    initialStep="password"
  />
);

// LogIn/Mobile/Step-03/Error (3991:13224) — generic credentials error, with
// the Terug/Inloggen row (also present, unconditionally, on Step3Password
// above) — design/notes/LoginForm.md.
export const Step3Error = () => (
  <LoginForm
    signInWithPasswordAction={mockSignInWithPassword}
    sendLoginCodeAction={mockSendLoginCode}
    lookupGreetingNameAction={mockLookupGreetingName(null)}
    initialStep="password"
    initialState={{ password: { status: "error", errorKey: "invalid-credentials" } }}
  />
);

// Step 3 after a failed send (rate limit): the error line under the login-code button.
export const LoginCodeRateLimited = () => (
  <LoginForm
    signInWithPasswordAction={mockSignInWithPassword}
    sendLoginCodeAction={mockSendLoginCode}
    lookupGreetingNameAction={mockLookupGreetingName(null)}
    initialStep="password"
    initialState={{ loginCode: { status: "error", errorKey: "rate-limited" } }}
  />
);

// Exit towards /login/code after a successful send: the form blurs out, the visual stays.
export const ExitAfterCodeSent = () => (
  <LoginForm
    signInWithPasswordAction={mockSignInWithPassword}
    sendLoginCodeAction={async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return { status: "sent" };
    }}
    lookupGreetingNameAction={mockLookupGreetingName("Carlotta")}
    initialStep="password"
    initialGreetingName="Carlotta"
    onNavigate={(href) => console.log("navigate", href)}
    onPrefetch={(href) => console.log("prefetch", href)}
  />
);

// Exit after sign-in: submit any password. The heading, field, buttons and link blur
// out top to bottom; onNavigate logs instead of leaving. Reload the story to replay.
export const ExitAfterSignIn = () => (
  <LoginForm
    signInWithPasswordAction={async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return { status: "success" };
    }}
    sendLoginCodeAction={mockSendLoginCode}
    lookupGreetingNameAction={mockLookupGreetingName("Carlotta")}
    initialStep="password"
    initialGreetingName="Carlotta"
    onNavigate={(href) => console.log("navigate", href)}
    onPrefetch={(href) => console.log("prefetch", href)}
  />
);
