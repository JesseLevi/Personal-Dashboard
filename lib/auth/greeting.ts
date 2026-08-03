export type GreetingKey = "night" | "morning" | "afternoon" | "evening";

// Figma Dev Mode annotation on node 3930:25897 (MCP drops annotations; read
// via the REST nodes endpoint — docs/guides/ui-components.md): 00:00-05:00
// Goeienacht, 05:00-12:00 Goeiemorgen, 12:00-18:00 Goeiemiddag, 18:00-00:00
// Goeieavond. Shared by app/login/page.tsx's server render (server clock)
// and LoginForm.tsx's post-mount correction (visitor's local clock) so both
// bucket the same hour the same way (#158).
export function greetingKeyForHour(hour: number): GreetingKey {
  if (hour < 5) return "night";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}
