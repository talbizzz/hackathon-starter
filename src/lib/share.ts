/** Native share sheet where available, clipboard otherwise. Must be called directly from a tap. */
export async function shareLink(data: { title: string; text: string; url: string }): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share(data);
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      // Share blocked (some in-app browsers): fall through to the clipboard.
    }
  }
  try {
    await navigator.clipboard.writeText(data.url);
    return "copied";
  } catch {
    return "failed";
  }
}
