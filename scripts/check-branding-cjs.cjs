// Simple check - uses pg package from node_modules
const path = require('path');
process.chdir('/opt/kla');
require('dotenv').config({ path: '.env' });
const { Client } = require(path.join('/opt/kla/node_modules/pg'));

const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(async () => {
  const { rows } = await client.query(
    `SELECT name, "logoUrl", "appName", "primaryColor", "sidebarColor", "accentColor", "faviconUrl", "loginBannerUrl" FROM tenants LIMIT 10`
  );
  console.table(rows);
  await client.end();
}).catch(err => { console.error(err.message); process.exit(1); });
