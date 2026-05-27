#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.join(__dir, '..', 'src', 'generated', 'prisma', 'index.ts');

const content = `// Re-export all generated Prisma types and enums for convenience
export * from "./enums";
export * from "./models";
`;

try {
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(indexPath, content, 'utf-8');
  console.log(`✔ Ensured index.ts exists at ${indexPath}`);
} catch (err) {
  console.error(`✗ Failed to write index.ts:`, err.message);
  process.exit(1);
}
