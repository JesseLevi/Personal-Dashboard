// design: Claude-designed, no Figma. See design/notes/LoginForm.md (magic-link confirm screen).
import type { ReactNode } from "react";
import Image from "next/image";
import { LoginExitProvider, LoginVisual } from "../../login/LoginExit";
import { ConfirmForm, type ConfirmFormProps } from "./ConfirmForm";
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import type { StoryDefault } from "@ladle/react";

export default { title: "Account / Confirm form" } satisfies StoryDefault;

const mockConfirm = async (formData: FormData) => {
  console.log("confirmMagicLink", Object.fromEntries(formData));
};

function Form(props: Partial<ConfirmFormProps>) {
  return <ConfirmForm maskedEmail="j****@example.com" tokenHash="hash" type="email" confirmAction={mockConfirm} {...props} />;
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

// Link opened in the browser that asked for the mail: the login cookie names the address.
export const KnownAddress = () => <Form />;

// Link opened elsewhere: no cookie, so a generic title and the "only if you asked" line.
export const UnknownAddress = () => <Form maskedEmail={null} />;

export const InPageFrame = () => (
  <PageFrame>
    <Form />
  </PageFrame>
);

export const InPageFrameUnknownAddress = () => (
  <PageFrame>
    <Form maskedEmail={null} />
  </PageFrame>
);

export const Overview = () => (
  <div>
    <StoryIntro
      what="Screen behind the link in the login mail: one button that confirms the sign-in."
      note="LoginForm"
    />
    <Specimens>
      <Specimen label="Known address" hint="Opened in the browser that asked for the mail">
        <KnownAddress />
      </Specimen>
      <Specimen label="Unknown address" hint="Opened elsewhere: generic title and a warning line">
        <UnknownAddress />
      </Specimen>
    </Specimens>
  </div>
);
