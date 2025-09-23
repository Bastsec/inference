import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import dotenv from 'dotenv';
import dns from 'node:dns';

dotenv.config();

// Lazily initialize DB client to avoid build-time env failures.
let _client: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getClient() {
  if (_client) return _client;
  const url = process.env.POSTGRES_URL;
  if (!url) {
    throw new Error('POSTGRES_URL environment variable is not set');
  }
  // Prefer IPv4 to avoid environments without IPv6 connectivity
  try {
    dns.setDefaultResultOrder('ipv4first');
  } catch {}
  _client = postgres(url, { ssl: 'require' });
  return _client;
}

function getDb() {
  if (_db) return _db;
  _db = drizzle(getClient(), { schema });
  return _db;
}

// Export lazy proxies to preserve existing import sites:
// - Accessing any property on `client`/`db` will initialize underlying instances.
export const client: ReturnType<typeof postgres> = new Proxy({} as any, {
  get(_t, p) {
    return (getClient() as any)[p];
  },
}) as any;

export const db: ReturnType<typeof drizzle<typeof schema>> = new Proxy({} as any, {
  get(_t, p) {
    return (getDb() as any)[p];
  },
}) as any;
