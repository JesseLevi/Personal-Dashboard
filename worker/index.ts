// Job queue consumer (Architecture §5, ADR-0006). Host undecided since the
// Mac mini was shelved (ADR-0018 §4); connects with service_role (bypasses RLS — this process is
// trusted infrastructure and must never execute user-supplied code or URLs
// without the SSRF guard, see ADR-0008).
//
// Phase 0 ships the loop skeleton + heartbeat; job handlers arrive in:
//   embed          — Phase 7 (ADR-0006)
//   agent          — Phase 8
//   calendar:sync  — Phase 9 (ADR-0008, SSRF guard mandatory)
import { createClient } from "@supabase/supabase-js";

const POLL_INTERVAL_MS = 5_000;
const HEARTBEAT_EVERY = 60; // polls between dead-man's-switch pings (§7)

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

type JobHandler = (payload: Record<string, unknown>) => Promise<void>;
const handlers: Record<string, JobHandler> = {
  // "embed": ...      Phase 7
  // "agent": ...      Phase 8
  // "calendar:sync":  Phase 9
};

async function heartbeat() {
  const url = process.env.HEALTHCHECKS_PING_URL;
  if (!url) return;
  await fetch(url, { method: "POST" }).catch(() => {});
}

async function claimAndRunOne(): Promise<boolean> {
  // claim_next_job() is a SECURITY DEFINER SQL function using
  // FOR UPDATE SKIP LOCKED (shipped with the jobs table migration, Phase 7).
  const { data: job, error } = await supabase.rpc("claim_next_job");
  if (error || !job) return false;

  const handler = handlers[job.type as string];
  try {
    if (!handler) throw new Error(`no handler for job type: ${job.type}`);
    await handler(job.payload);
    await supabase.from("jobs").update({ status: "done" }).eq("id", job.id);
  } catch (err) {
    await supabase
      .from("jobs")
      .update({
        status: job.attempts >= 5 ? "failed" : "pending",
        attempts: job.attempts + 1,
        run_at: new Date(Date.now() + 2 ** job.attempts * 60_000).toISOString(),
        last_error: String(err).slice(0, 2000),
      })
      .eq("id", job.id);
  }
  return true;
}

async function main() {
  console.log("worker: started");
  let polls = 0;
  let running = true;
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, () => {
      console.log(`worker: ${sig}, draining`);
      running = false;
    });
  }
  while (running) {
    const didWork = Object.keys(handlers).length > 0 && (await claimAndRunOne());
    if (++polls % HEARTBEAT_EVERY === 0) await heartbeat();
    if (!didWork) await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  console.log("worker: stopped");
}

main().catch((err) => {
  console.error("worker: fatal", err);
  process.exit(1);
});
