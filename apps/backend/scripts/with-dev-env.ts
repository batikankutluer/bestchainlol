#!/usr/bin/env bun
/**
 * Runs a command with the same development defaults the application uses.
 *
 * The Prisma CLI reads DATABASE_URL from the real environment and knows nothing
 * about the app's fallbacks, so without this `bun run db:migrate` fails on a
 * fresh clone while the app itself starts fine — the confusing half-working
 * state this whole mechanism exists to avoid.
 *
 *   bun scripts/with-dev-env.ts prisma migrate deploy
 */
import { applyDevelopmentDefaults } from '../src/common/config/development-defaults.js';

applyDevelopmentDefaults();

const argv = Bun.argv.slice(2);
if (argv.length === 0) {
  console.error('usage: bun scripts/with-dev-env.ts <command> [args...]');
  process.exit(64);
}

const child = Bun.spawn(['bunx', ...argv], {
  stdin: 'inherit',
  stdout: 'inherit',
  stderr: 'inherit',
  env: process.env,
});

process.exit(await child.exited);
