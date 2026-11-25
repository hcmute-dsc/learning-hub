import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  GITHUB_CLIENT_ID: z.string().default(''),
  GITHUB_CLIENT_SECRET: z.string().default(''),
  /** Optional extra rule: members of this GitHub org are approved too. Empty = off. */
  GITHUB_ORG: z.string().default(''),
  BOOTSTRAP_ADMIN_GITHUB_LOGIN: z
    .string()
    .optional()
    .transform((v) => (v ? v.trim().toLowerCase() : undefined)),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  /**
   * Proxy hops in front of the API (Express "trust proxy"), so req.ip is the member's
   * IP for the per-IP rate limit. 1 = the web app's /api rewrite and server-side calls.
   * Production behind Cloudflare + Traefik: 2 (deploy/.env.example).
   */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
  // Content source (CONTENT-SPECIFICATION §8): a local folder for dev, or a GitHub repo
  /** local = a folder (dev), github = one content repo, registry = tracks.yaml + one repo per track (ADR-10) */
  CONTENT_SOURCE: z.enum(['local', 'github', 'registry']).default('local'),
  CONTENT_LOCAL_DIR: z.string().default('../../content-example'),
  CONTENT_REPO: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/)
    .default('hcmute-dsc/learning-hub-content'),
  CONTENT_BRANCH: z.string().default('main'),
  /** Optional: raises GitHub rate limits / reads a private repo. Read-only scope. */
  CONTENT_GITHUB_TOKEN: z.string().optional(),
  // Reference solutions (CONTENT-SPECIFICATION §3.8): the PRIVATE checker repo, never the content repo
  /** none = no solutions, local = a folder (dev, checker-example), github = the checker repo */
  SOLUTIONS_SOURCE: z.enum(['none', 'local', 'github']).default('none'),
  SOLUTIONS_LOCAL_DIR: z.string().default('../../checker-example'),
  SOLUTIONS_REPO: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/)
    .default('hcmute-dsc/learning-hub-checker'),
  SOLUTIONS_BRANCH: z.string().default('main'),
  /** Read-only token that can read the private checker repo. Falls back to CONTENT_GITHUB_TOKEN. */
  SOLUTIONS_GITHUB_TOKEN: z.string().optional(),
  /**
   * The organization's GitHub App (`hcmute-dsc-learning-hub`, SECURITY §10), used by
   * "Tạo issue trên GitHub" for content reports (learning-hub#121). It needs
   * "Issues: Read and write" on the track repos. Client ID, and the private key (.pem) with
   * newlines written as `
`. Either empty = the button is hidden.
   */
  GITHUB_APP_CLIENT_ID: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined),
  GITHUB_APP_PRIVATE_KEY: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined),
  /** Target time for a mentor review, shown in the queue (E7; per semester, BACKEND-DESIGN). */
  REVIEW_TARGET_HOURS: z.coerce.number().int().min(1).max(720).default(72),
  /**
   * Leaderboard score of one completed exercise (E14, ADR-08): graded = passed
   * automatically or approved by a mentor; self_check counts less. Set per term.
   */
  LEADERBOARD_WEIGHT_GRADED: z.coerce.number().int().min(1).max(100).default(3),
  LEADERBOARD_WEIGHT_SELF_CHECK: z.coerce.number().int().min(0).max(100).default(1),
  /**
   * Discord application for "Kết nối Discord" in /settings (learning-hub#76, scope
   * `identify` only). Both empty = the button is hidden and nobody can link.
   */
  DISCORD_CLIENT_ID: z.string().default(''),
  DISCORD_CLIENT_SECRET: z.string().default(''),
  /** Discord channel webhook for club notifications (E9). Empty = notifications off. */
  DISCORD_WEBHOOK_URL: z
    .string()
    .url()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  /** Discord webhook for ops alerts: server errors (E11). Empty = alerts off. */
  DISCORD_ALERT_WEBHOOK_URL: z
    .string()
    .url()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  // Email digest (learning-hub#49). Empty SMTP_HOST = no email: the digest toggle is disabled.
  SMTP_HOST: z.string().default(''),
  /** 587 = STARTTLS, 465 = TLS from the first byte */
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASSWORD: z.string().default(''),
  /** Sender shown to members, e.g. "HCMUTE DSC Learning Hub <no-reply@example.org>" */
  SMTP_FROM: z.string().default(''),
});

export type Env = z.infer<typeof envSchema>;

/** Parse once at startup; fail fast with a readable message. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return parsed.data;
}

export const ENV = Symbol('ENV');
