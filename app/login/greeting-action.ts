// STUB — replaced by agent A's implementation at integration (#407)
"use server";

export async function lookupGreetingName(input: {
  email: string;
  turnstileToken: string | null;
}): Promise<{ name: string | null }> {
  void input;
  return { name: null };
}
