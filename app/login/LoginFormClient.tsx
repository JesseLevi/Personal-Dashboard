"use client";

import { useRouter } from "next/navigation";
import { LoginForm, type LoginFormProps } from "./LoginForm";
import { useLoginExit } from "./LoginExit";

// Supplies the router so LoginForm stays free of next/navigation (Ladle has no app router).
export function LoginFormClient(props: Omit<LoginFormProps, "onNavigate" | "onPrefetch" | "onExitStart" | "onExitEnd">) {
  const router = useRouter();
  const { startExit, finishExit } = useLoginExit();
  return (
    <LoginForm
      {...props}
      onNavigate={(href) => router.replace(href)}
      onPrefetch={(href) => router.prefetch(href)}
      onExitStart={startExit}
      onExitEnd={finishExit}
    />
  );
}
