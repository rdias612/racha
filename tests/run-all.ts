import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const smokeTests = [
  'auth-local.smoke.ts',
  'expenses.smoke.ts',
  'fifo.smoke.ts',
  'goleiros.smoke.ts',
  'payments.smoke.ts',
  'rsvp.smoke.ts',
  'sumula.smoke.ts',
  'teams.smoke.ts',
  'timezone.smoke.ts',
  'whatsapp.smoke.ts',
];

const tsxCli = resolve(process.cwd(), 'node_modules/tsx/dist/cli.mjs');
let failed = false;

for (const fileName of smokeTests) {
  const result = spawnSync(process.execPath, [tsxCli, resolve(__dirname, fileName)], {
    stdio: 'inherit',
  });
  if (result.error || result.status !== 0) failed = true;
}

process.exitCode = failed ? 1 : 0;
