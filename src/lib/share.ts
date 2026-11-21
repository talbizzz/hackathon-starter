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

/** Whether this browser has a native share sheet. */
export function canShare() {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

/** Open the native share sheet. Resolves false if it was blocked (a dismissed sheet counts as fine). */
export async function nativeShare(data: { title: string; text: string; url: string }): Promise<boolean> {
  try {
    await navigator.share(data);
    return true;
  } catch (error) {
    return error instanceof DOMException && error.name === "AbortError";
  }
}

export async function copyLink(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}
