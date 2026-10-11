"use client";

import { useRouter } from "next/navigation";
import { LoginForm, type LoginFormProps } from "./LoginForm";

// Supplies the router so LoginForm stays free of next/navigation (Ladle has no app router).
export function LoginFormClient(props: Omit<LoginFormProps, "onNavigate" | "onPrefetch">) {
  const router = useRouter();
  return (
    <LoginForm
      {...props}
      onNavigate={(href) => router.replace(href)}
      onPrefetch={(href) => router.prefetch(href)}
    />
  );
}
