import "server-only";

export class UpstreamError extends Error {
  constructor(
    message: string,
    public readonly source: string,
    public readonly status: number,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "UpstreamError";
  }

  get isRateLimited() {
    return this.status === 429;
  }
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RateLimiter {
  schedule<T>(task: () => Promise<T>): Promise<T>;
  pause(ms: number): void;
  /** Rough milliseconds a request scheduled now would wait before starting. */
  estimatedWait(): number;
}

/**
 * Sliding-window limiter: at most `limit` request starts per `windowMs`,
 * with at least `minGapMs` between starts. `pause` (used on 429 or when the
 * upstream reports zero remaining quota) delays every queued request.
 */
export class WindowLimiter implements RateLimiter {
  private starts: number[] = [];
  private pauseUntil = 0;
  private lastStart = 0;
  private queued = 0;
  private chain: Promise<void> = Promise.resolve();

  constructor(
    private limit: number,
    private windowMs: number,
    private minGapMs = 0,
  ) {}

  pause(ms: number) {
    this.pauseUntil = Math.max(this.pauseUntil, Date.now() + ms);
  }

  private prune(now: number) {
    while (this.starts.length && this.starts[0] <= now - this.windowMs) this.starts.shift();
  }

  estimatedWait() {
    const now = Date.now();
    this.prune(now);
    const pauseWait = Math.max(0, this.pauseUntil - now);
    const gapWait = Math.max(0, this.lastStart + this.minGapMs * (this.queued + 1) - now);
    const pending = this.starts.length + this.queued;
    if (pending < this.limit) return Math.max(pauseWait, gapWait);
    const slot = this.starts[Math.min(pending - this.limit, this.starts.length - 1)] ?? now;
    return Math.max(pauseWait, gapWait, slot + this.windowMs - now);
  }

  schedule<T>(task: () => Promise<T>): Promise<T> {
    this.queued++;
    const run = this.chain.then(async () => {
      for (;;) {
        const now = Date.now();
        this.prune(now);
        const wait = Math.max(
          this.pauseUntil - now,
          this.lastStart + this.minGapMs - now,
          this.starts.length >= this.limit ? this.starts[0] + this.windowMs - now : 0,
        );
        if (wait <= 0) break;
        await sleep(wait + 10);
      }
      this.lastStart = Date.now();
      this.starts.push(this.lastStart);
      this.queued--;
    });
    this.chain = run.catch(() => undefined);
    return run.then(task);
  }
}

interface FetchJsonOptions extends RequestInit {
  source: string;
  timeoutMs?: number;
  retries?: number;
  limiter?: RateLimiter;
  /** Never wait longer than this for a rate-limit window to reopen. */
  maxRetryWaitMs?: number;
  onResponse?: (response: Response) => void;
}

export async function fetchJson<T>(url: string, options: FetchJsonOptions): Promise<T> {
  const {
    source,
    timeoutMs = 12_000,
    retries = 2,
    limiter,
    maxRetryWaitMs = 8_000,
    onResponse,
    ...init
  } = options;

  let attempt = 0;
  for (;;) {
    const exec = async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
      } finally {
        clearTimeout(timer);
      }
    };

    let response: Response;
    try {
      response = await (limiter ? limiter.schedule(exec) : exec());
    } catch (error) {
      if (attempt < retries) {
        attempt++;
        await sleep(400 * attempt);
        continue;
      }
      const reason = error instanceof Error && error.name === "AbortError" ? "timed out" : "failed";
      throw new UpstreamError(`${source} request ${reason}`, source, 0);
    }

    onResponse?.(response);

    if (response.ok) {
      return (await response.json()) as T;
    }

    const retryAfterHeader = response.headers.get("retry-after");
    const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : undefined;
    const retryable = response.status === 429 || response.status >= 500;

    if (response.status === 429 && limiter) {
      limiter.pause(retryAfterMs ?? 2_000);
    }

    const waitMs = retryAfterMs ?? 600 * 2 ** attempt;
    if (retryable && attempt < retries && waitMs <= maxRetryWaitMs) {
      attempt++;
      await sleep(waitMs);
      continue;
    }

    let detail = "";
    try {
      detail = (await response.text()).slice(0, 200);
    } catch {
      /* body already consumed or unreadable */
    }
    throw new UpstreamError(
      `${source} responded ${response.status}${detail ? `: ${detail}` : ""}`,
      source,
      response.status,
      retryAfterMs,
    );
  }
}
