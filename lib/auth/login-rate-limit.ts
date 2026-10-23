import "server-only";
import { createSupabaseAnonClient } from "@/lib/supabase/anon";

// Client for public.login_rate_limit (database-backed, keyed by address, client
// and globally). Never log email, IP or key.
//
// Failure policy: a missing function (code deployed before its migration) logs
// loudly and lets the call through, so login keeps working during that window.
// Any other error (database unreachable, bad arguments) refuses the call.

export type LoginRateAction = "password" | "verify" | "send";

// PostgREST "function not found" / Postgres undefined_function.
const MISSING_FUNCTION_CODES = new Set(["PGRST202", "42883"]);

async function call(
  action: LoginRateAction,
  email: string,
  clientKey: string,
  mode: "consume" | "refund",
): Promise<boolean> {
  try {
    const { data, error } = await createSupabaseAnonClient().rpc("login_rate_limit", {
      p_action: action,
      p_email: email,
      p_client_key: clientKey,
      p_mode: mode,
    });
    if (error) {
      if (error.code && MISSING_FUNCTION_CODES.has(error.code)) {
        console.error("login_rate_limit is missing: apply the pending migration");
        return true;
      }
      return false;
    }
    return data === true;
  } catch {
    return false;
  }
}

/** Counts one attempt; false = over a limit, the caller must refuse without trying. */
export const consumeLoginAttempt = (action: LoginRateAction, email: string, clientKey: string) =>
  call(action, email, clientKey, "consume");

/** Gives the latest attempt back after a success. */
export const refundLoginAttempt = (action: LoginRateAction, email: string, clientKey: string) =>
  call(action, email, clientKey, "refund");
