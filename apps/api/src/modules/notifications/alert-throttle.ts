/**
 * Keeps server-error alerts readable (E11): when the database goes down every request
 * fails, and one alert is enough. Pure and in-memory: alerts are best effort, and one
 * API process is all we run (deploy/README.md).
 */
export interface AlertThrottleOptions {
  /** the same error signature is sent at most once per this window */
  perSignatureMs?: number;
  /** at most `globalMax` alerts of any kind per `globalWindowMs` */
  globalMax?: number;
  globalWindowMs?: number;
}

export interface ThrottleDecision {
  send: boolean;
  /** alerts dropped since the last one sent; reported in the next alert */
  suppressed: number;
}

export class AlertThrottle {
  private readonly perSignatureMs: number;
  private readonly globalMax: number;
  private readonly globalWindowMs: number;
  private readonly lastSent = new Map<string, number>();
  private sentTimes: number[] = [];
  private suppressed = 0;

  constructor(options: AlertThrottleOptions = {}) {
    this.perSignatureMs = options.perSignatureMs ?? 10 * 60_000;
    this.globalMax = options.globalMax ?? 10;
    this.globalWindowMs = options.globalWindowMs ?? 60 * 60_000;
  }

  check(signature: string, now: number): ThrottleDecision {
    this.prune(now);
    if (this.lastSent.has(signature) || this.sentTimes.length >= this.globalMax) {
      this.suppressed++;
      return { send: false, suppressed: this.suppressed };
    }
    this.lastSent.set(signature, now);
    this.sentTimes.push(now);
    const suppressed = this.suppressed;
    this.suppressed = 0;
    return { send: true, suppressed };
  }

  /** Forget old entries, so the map cannot grow without limit. */
  private prune(now: number): void {
    for (const [signature, at] of this.lastSent) {
      if (now - at >= this.perSignatureMs) this.lastSent.delete(signature);
    }
    this.sentTimes = this.sentTimes.filter((at) => now - at < this.globalWindowMs);
  }
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * "Same error" = same method, route shape and error text. Ids and numbers are
 * replaced so /submissions/<id-1> and /submissions/<id-2> count as one error.
 */
export function errorSignature(
  method: string,
  path: string,
  errorName: string,
  errorMessage: string,
): string {
  const normalize = (s: string) => s.replace(UUID, ':id').replace(/\d+/g, ':n');
  return [method, normalize(path), errorName, normalize(errorMessage).slice(0, 120)].join('|');
}
