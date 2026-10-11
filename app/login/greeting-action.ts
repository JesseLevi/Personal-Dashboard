"use server";

import { lookupGreetingName as lookup } from "@/lib/auth/greeting-lookup";

// Thin wrapper (ADR-0031): all logic lives in lib/auth/greeting-lookup.ts.
export async function lookupGreetingName(input: {
  email: string;
  turnstileToken: string | null;
}): Promise<{ name: string | null }> {
  return lookup(input);
}
