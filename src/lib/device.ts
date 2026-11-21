// Anonymous identity: one random id per browser. Used to count distinct people and
// to allow one vote per device, with no signup.
const KEY = "device_id";

/** Random UUID. crypto.randomUUID only exists on https and localhost, so plain-http dev on a phone needs the fallback. */
export function uuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
let memoryId: string | null = null;

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return saved;
    const id = uuid();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    // Storage blocked (private mode, some in-app browsers): stable for this page load only.
    memoryId ??= uuid();
    return memoryId;
  }
}
