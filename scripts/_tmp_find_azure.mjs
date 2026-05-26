import { PrismaClient } from '../src/generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
const adapter = new PrismaPg({ connectionString: 'postgresql://kla:kla_dev_password@localhost:5432/kla_dev?schema=public' });
const db = new PrismaClient({ adapter });

// Revert the two non-island courses back to localhost:9000
const toRevert = ['Workplace Safety Fundamentals', 'Information Security Awareness'];
for (const title of toRevert) {
  const c = await db.course.findFirst({ where: { title }, select: { id: true, thumbnailUrl: true } });
  if (c?.thumbnailUrl?.includes('hanson01')) {
    const reverted = c.thumbnailUrl.replace('https://hanson01.eastus.cloudapp.azure.com', 'http://localhost:9000');
    await db.course.update({ where: { id: c.id }, data: { thumbnailUrl: reverted } });
    console.log(`Reverted ${title} -> ${reverted}`);
  }
}
console.log('Done.');
await db.$disconnect();


