/** "jesse@example.com" -> "j****@example.com": enough to recognise, not enough to read out. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return email;
  const local = email.slice(0, at);
  return `${local[0]}${"*".repeat(Math.min(local.length - 1, 4))}${email.slice(at)}`;
}
