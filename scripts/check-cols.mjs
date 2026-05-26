import pg from "pg";
import "dotenv/config";
const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const r = await c.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='tenants' ORDER BY ordinal_position");
console.log(r.rows.map(x => x.column_name).join(", "));
await c.end();
