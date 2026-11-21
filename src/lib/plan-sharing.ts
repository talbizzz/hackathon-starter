/** Keeps saving and native sharing on separate taps, and locks before React rerenders. */
export class PlanSharing {
  private pending = false;
  private saved: { key: string; id: string } | null = null;

  get busy() {
    return this.pending;
  }

  savedId(key: string) {
    return this.saved?.key === key ? this.saved.id : null;
  }

  reset() {
    if (this.pending) return false;
    this.saved = null;
    return true;
  }

  async activate<T>(key: string, save: () => Promise<string>, share: (id: string) => Promise<T>) {
    if (this.pending) return { kind: "busy" } as const;
    this.pending = true;
    try {
      const id = this.savedId(key);
      if (id) {
        // Invoke immediately, before any await, to preserve the tap's native-share permission.
        return { kind: "shared", result: await share(id) } as const;
      }
      this.saved = null;
      const savedId = await save();
      this.saved = { key, id: savedId };
      return { kind: "saved", id: savedId } as const;
    } finally {
      this.pending = false;
    }
  }
}
