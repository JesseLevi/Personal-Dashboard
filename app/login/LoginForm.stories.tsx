// figma: node-id=3934:32620 (Step-01), 3933:32343 (Step-03), 3985:10266
// (Error), 3989:13128 (InloglinkSend) — see design/notes/LoginForm.md.
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

// LogIn/Mobile/Step-01 (3934:32620) — first load, empty email field.
export const Step1Email = () => (
  <LoginForm
    signInWithPasswordAction={mockSignInWithPassword}
    sendMagicLinkAction={mockSendMagicLink}
    serverGreetingKey="afternoon"
  />
);

// LogIn/Mobile/Step-03 (3933:32343) — password pane, idle.
export const Step3Password = () => (
  <LoginForm
    signInWithPasswordAction={mockSignInWithPassword}
    sendMagicLinkAction={mockSendMagicLink}
    serverGreetingKey="afternoon"
    initialStep="password"
  />
);

// LogIn/Mobile/Error (3985:10266) — generic credentials error, reused on the
// Step-03/password pane per #158's deliberate deviation from the fetched
// frame (design/notes/LoginForm.md).
export const Step3Error = () => (
  <LoginForm
    signInWithPasswordAction={mockSignInWithPassword}
    sendMagicLinkAction={mockSendMagicLink}
    serverGreetingKey="afternoon"
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
    serverGreetingKey="afternoon"
    initialStep="password"
    initialState={{ magicLink: { status: "sent" } }}
  />
);
