import { z } from "zod";

// Sign-in only validates shape, not password policy — accounts are provisioned
// via Supabase, there is no self-signup flow this round (issue #7).
export const passwordLoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const magicLinkSchema = z.object({
  email: z.email(),
});
