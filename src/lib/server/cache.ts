import "server-only";

interface Entry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Small in-memory TTL + LRU cache. Lives on globalThis so it survives
 * hot reloads in development and is shared across route handlers.
 * Concurrent requests for the same key share one in-flight promise.
 */
class TtlCache {
  private store = new Map<string, Entry<unknown>>();
  private inflight = new Map<string, Promise<unknown>>();

  constructor(private maxEntries: number) {}

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number) {
    this.store.delete(key);
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  async wrap<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const hit = this.get<T>(key);
    if (hit !== undefined) return hit;
    const pending = this.inflight.get(key);
    if (pending) return pending as Promise<T>;
    const promise = loader()
      .then((value) => {
        this.set(key, value, ttlMs);
        return value;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }
}

const globalForCache = globalThis as unknown as { __animeCache?: TtlCache };

export const cache = (globalForCache.__animeCache ??= new TtlCache(5000));

export const TTL = {
  minute: 60_000,
  hour: 60 * 60_000,
  day: 24 * 60 * 60_000,
} as const;
