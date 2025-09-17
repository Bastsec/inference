'use server';

import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { client } from './drizzle';

function resolveMigrationsDir() {
  const cwd = process.cwd();
  return path.resolve(cwd, 'lib/db/migrations');
}

export async function runMigrations() {
  const migrationsDir = resolveMigrationsDir();

  
  await client`
    CREATE TABLE IF NOT EXISTS app_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz DEFAULT now()
    )
  `;

  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith('.sql'))
    .map((e) => e.name)
    .sort(); 

  for (const file of files) {
    const [{ count }] = await client`
      SELECT COUNT(*)::int AS count FROM app_migrations WHERE name = ${file}
    ` as unknown as Array<{ count: number }>;

    if (count > 0) {
      continue; 
    }

    const sqlText = await fs.readFile(path.join(migrationsDir, file), 'utf8');

    await client.begin(async (trx) => {
      await trx.unsafe(sqlText);
      await trx`
        INSERT INTO app_migrations (name) VALUES (${file})
      `;
    });
  }
}

if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  runMigrations()
    .then(() => {
      console.log('Migrations completed');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
