/**
 * A Server Action that sets the session cookie makes Next.js re-render the current route in the
 * same response. Redirecting then would unmount LoginForm before its exit animation, so only a
 * plain request of /login by an already signed-in user redirects.
 */
export function shouldRedirectAuthenticated({
  userId,
  isServerAction,
}: {
  userId: string | null | undefined;
  isServerAction: boolean;
}): boolean {
  return Boolean(userId) && !isServerAction;
}
