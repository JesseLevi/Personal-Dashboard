"use client";

import { useRouter } from "next/navigation";
import { LoginCodeForm, type LoginCodeFormProps } from "./LoginCodeForm";
import { useLoginExit } from "../LoginExit";

// Supplies the router so LoginCodeForm stays free of next/navigation (Ladle has no app router).
export function LoginCodeFormClient(props: Omit<LoginCodeFormProps, "onNavigate" | "onPrefetch" | "onExitStart">) {
  const router = useRouter();
  const { startExit } = useLoginExit();
  return (
    <LoginCodeForm
      {...props}
      onNavigate={(href) => router.replace(href)}
      onPrefetch={(href) => router.prefetch(href)}
      onExitStart={startExit}
    />
  );
}
