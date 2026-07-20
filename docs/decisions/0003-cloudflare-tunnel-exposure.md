# ADR-0003: Cloudflare Tunnel exposure; Supabase and Ollama LAN-only

**Status**: Accepted (user decision, 2026-07-20)

## Context

The platform runs on a Mac mini at home and must be reachable away from home. Options considered: VPN-only (Tailscale), public reverse proxy, Cloudflare Tunnel. The user chose Cloudflare Tunnel.

## Decision

- `cloudflared` runs on the Mac mini; no inbound router ports. Tunnel routes `dash.<domain>` → prod Next.js and `staging.<domain>` → staging Next.js.
- **Only the Next.js apps are tunneled.** Supabase (API, Studio) and Ollama bind to localhost/LAN and are never exposed; the browser reaches data exclusively through Next.js server code.
- Staging sits behind **Cloudflare Access** (email allowlist). Prod relies on Supabase Auth; adding Access on prod later is a config change, not an architecture change.
- Enable Cloudflare's baseline protections on the hostname (bot fight mode, rate limiting rule on `/auth/*`).

## Consequences

- No open ports, DDoS/CDN shielding for free, works from any network without a VPN client.
- Dependency on Cloudflare as a third party in the request path — accepted; can be swapped for Tailscale/reverse proxy later without app changes.
- Because Supabase is not exposed, the app cannot use supabase-js directly from the browser; all data access goes through server components/actions. Tickets must follow this pattern.
