import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
const adapter = new PrismaPg({ connectionString: 'postgresql://kla:kla_dev_password@localhost:5432/kla_dev?schema=public' });
const db = new PrismaClient({ adapter });
const courses = await db.course.findMany({ select: { id: true, title: true, status: true }, orderBy: { createdAt: 'desc' }, take: 10 });
console.log(JSON.stringify(courses, null, 2));
await db.$disconnect();
