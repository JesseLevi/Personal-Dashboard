// figma: node-id=4221:14843 (Step-01 heading), 4221:14891 (Step-02 heading),
// 3934:32620 (Step-01), 3933:32343 (Step-03), 3985:10266
// (Error), 3989:13128 (InloglinkSend), 3991:13224 (Step-03/Error, fix
// round — the Terug/Inloggen row) — see design/notes/LoginForm.md.
import { LoginForm } from "./LoginForm";
import type { MagicLinkState, PasswordLoginState } from "./actions";

// Dev-only mock actions — LoginForm never imports the real "use server"
// module itself (same precedent as CategoryPanel.stories.tsx): the composer
// (app/login/page.tsx) passes the real actions as props so these stand in
// for signInWithPassword/sendMagicLink without needing Supabase/Next's
// request context. Never resolve for real — `initialStep`/`initialState`
// put each story straight into the state it needs to show.
async function mockSignInWithPassword(
  prevState: PasswordLoginState,
  formData: FormData,
): Promise<PasswordLoginState> {
  console.log("signInWithPassword", prevState, Object.fromEntries(formData));
  return { status: "idle" };
}
async function mockSendMagicLink(
  prevState: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  console.log("sendMagicLink", prevState, Object.fromEntries(formData));
  return { status: "idle" };
}

async function mockLookupGreetingName(): Promise<{ name: string | null }> {
  return { name: null };
}

// LogIn/Mobile/Step-01 (3934:32620) — first load, empty email field.
export const Step1Email = () => (
  <LoginForm
    signInWithPasswordAction={mockSignInWithPassword}
    sendMagicLinkAction={mockSendMagicLink}
    lookupGreetingNameAction={mockLookupGreetingName}
  />
);

// LogIn/Mobile/Step-03 (3933:32343) — password pane, idle.
export const Step3Password = () => (
  <LoginForm
    signInWithPasswordAction={mockSignInWithPassword}
    sendMagicLinkAction={mockSendMagicLink}
    lookupGreetingNameAction={mockLookupGreetingName}
    initialStep="password"
  />
);

// LogIn/Mobile/Step-03/Error (3991:13224) — generic credentials error, with
// the Terug/Inloggen row (also present, unconditionally, on Step3Password
// above) — design/notes/LoginForm.md.
export const Step3Error = () => (
  <LoginForm
    signInWithPasswordAction={mockSignInWithPassword}
    sendMagicLinkAction={mockSendMagicLink}
    lookupGreetingNameAction={mockLookupGreetingName}
    initialStep="password"
    initialState={{ password: { status: "error", errorKey: "invalid-credentials" } }}
  />
);

// LogIn/Mobile/InloglinkSend (3989:13128) — magic-link button after a
// successful send: "Inlog link verstuurd" + Icon/Check, disabled.
export const MagicLinkSent = () => (
  <LoginForm
    signInWithPasswordAction={mockSignInWithPassword}
    sendMagicLinkAction={mockSendMagicLink}
    lookupGreetingNameAction={mockLookupGreetingName}
    initialStep="password"
    initialState={{ magicLink: { status: "sent" } }}
  />
);

// LogIn/Mobile/Step-02 (4221:14891) — heading with the resolved first name.
export const NameResolved = () => (
  <LoginForm
    signInWithPasswordAction={mockSignInWithPassword}
    sendMagicLinkAction={mockSendMagicLink}
    lookupGreetingNameAction={mockLookupGreetingName}
    initialStep="password"
    initialGreetingName="Carlotta"
  />
);
