// Anonymous identity: one random id per browser. Used to count distinct people and
// to allow one vote per device, with no signup.
const KEY = "device_id";
let memoryId: string | null = null;

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return saved;
    const id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    // Storage blocked (private mode, some in-app browsers): stable for this page load only.
    memoryId ??= crypto.randomUUID();
    return memoryId;
  }
}
