import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import dotenv from 'dotenv';
import dns from 'node:dns';

dotenv.config();

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL environment variable is not set');
}

// Prefer IPv4 to avoid environments without IPv6 connectivity
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

// Require SSL for providers like Supabase
export const client = postgres(process.env.POSTGRES_URL, {
  ssl: 'require',
});
export const db = drizzle(client, { schema });
