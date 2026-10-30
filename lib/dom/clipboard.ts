/**
 * Copies text, or text that is still being fetched. The promise goes into a ClipboardItem so Safari
 * keeps the click's user gesture alive across the await; browsers without ClipboardItem await first.
 */
export async function copyToClipboard(text: string | Promise<string>): Promise<void> {
  if (typeof text !== "string" && typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
    const blob = text.then((value) => new Blob([value], { type: "text/plain" }));
    await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
    return;
  }
  await navigator.clipboard.writeText(await text);
}
