import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/** How long to keep trying before giving up in production. */
const PRODUCTION_ATTEMPTS = 10;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 5_000;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private reconnecting = false;
  private stopped = false;

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('connected to postgres');
      return;
    } catch (error) {
      // Prisma's connection errors arrive with the whole minified client bundle
      // attached. Logging the message alone is the difference between one
      // readable line and fifty lines of unreadable JavaScript.
      const reason = describe(error);

      if (process.env.NODE_ENV === 'production') {
        await this.connectWithRetries();
        return;
      }

      // In development the database usually just is not up yet — the two
      // terminals get started in either order. Rather than dying and making
      // that an ordering rule, say so plainly and keep trying in the
      // background. /health reports postgres as down until it succeeds.
      this.logger.warn(
        `postgres unreachable — ${reason}\n` +
          '  The app is running anyway and will connect as soon as it can.\n' +
          '  If you have not started it yet:  docker compose up -d --build',
      );
      void this.retryInBackground();
    }
  }

  async onModuleDestroy() {
    this.stopped = true;
    await this.$disconnect();
  }

  /** Bounded retries, then give up — a production app without its database
   *  should not sit there pretending to be healthy. */
  private async connectWithRetries(): Promise<void> {
    for (let attempt = 1; attempt <= PRODUCTION_ATTEMPTS; attempt += 1) {
      await sleep(backoff(attempt));
      try {
        await this.$connect();
        this.logger.log(`connected to postgres after ${attempt} attempt(s)`);
        return;
      } catch (error) {
        this.logger.warn(
          `postgres unreachable (attempt ${attempt}/${PRODUCTION_ATTEMPTS}) — ${describe(error)}`,
        );
      }
    }
    throw new Error(
      `Could not reach the database after ${PRODUCTION_ATTEMPTS} attempts. Check DATABASE_URL.`,
    );
  }

  /** Unbounded, quiet retries for development. */
  private async retryInBackground(): Promise<void> {
    if (this.reconnecting) return;
    this.reconnecting = true;

    for (let attempt = 1; !this.stopped; attempt += 1) {
      await sleep(backoff(attempt));
      if (this.stopped) break;
      try {
        await this.$connect();
        this.logger.log('connected to postgres');
        this.reconnecting = false;
        return;
      } catch {
        // Silent: the first warning already said what is wrong, and repeating
        // it every few seconds would bury the frontends' output.
      }
    }
    this.reconnecting = false;
  }

  /**
   * Prisma's own pool/query counters in Prometheus text format. Merged into the
   * /metrics endpoint so connection-pool saturation is visible next to HTTP data.
   */
  async prometheusMetrics(): Promise<string> {
    return this.$metrics.prometheus();
  }
}

/** First line only — Prisma appends the client bundle to `message`. */
function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const firstMeaningfulLine = error.message
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith('at '));
  return firstMeaningfulLine ?? error.name;
}

const backoff = (attempt: number) => Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
