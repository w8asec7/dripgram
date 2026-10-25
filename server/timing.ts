/** Numeric-only timings: no queries, photos, tokens, URLs or identity in diagnostics. */
export class ShoppingTiming {
  private values = new Map<string, number>();
  private started = performance.now();
  add(name: string, ms: number) {
    this.values.set(name, (this.values.get(name) || 0) + ms);
  }
  async measure<T>(name: string, run: () => Promise<T>) {
    const start = performance.now();
    try {
      return await run();
    } finally {
      this.add(name, performance.now() - start);
    }
  }
  header() {
    this.values.set("total", performance.now() - this.started);
    return [...this.values]
      .map(([key, ms]) =>
        key.endsWith("_calls")
          ? `${key};desc="${ms}"`
          : `${key};dur=${ms.toFixed(1)}`,
      )
      .join(", ");
  }
}
