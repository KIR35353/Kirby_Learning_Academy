import { createRequire } from 'module';
import { createConnection } from 'net';
import { readFileSync } from 'fs';

// Read DATABASE_URL from .env
const env = readFileSync('.env', 'utf8');
const dbUrl = env.match(/DATABASE_URL="([^"]+)"/)?.[1];
if (!dbUrl) { console.error('No DATABASE_URL'); process.exit(1); }

// Use pg
const { default: pg } = await import('pg');
const client = new pg.Client({ connectionString: dbUrl });
await client.connect();
const { rows } = await client.query(`
  SELECT name, "logoUrl", "appName", "primaryColor", "sidebarColor", "accentColor", "faviconUrl", "loginBannerUrl"
  FROM tenants LIMIT 10
`);
console.table(rows);
await client.end();
