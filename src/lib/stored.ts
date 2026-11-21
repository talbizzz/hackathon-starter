import { useSyncExternalStore } from "react";

// Small localStorage-backed values that survive reloads (neighbourhood, voter name).
// Falls back to memory when storage is blocked (private mode, some in-app browsers).
const listeners = new Set<() => void>();
const memory = new Map<string, string>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function read(key: string): string | null {
  if (memory.has(key)) return memory.get(key)!;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setStored(key: string, value: string) {
  memory.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {}
  listeners.forEach((notify) => notify());
}

/** Null on the server and until a value has been stored. */
export function useStored(key: string): string | null {
  return useSyncExternalStore(subscribe, () => read(key), () => null);
}
