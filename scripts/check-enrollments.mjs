import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
const adapter = new PrismaPg({ connectionString: 'postgresql://kla:kla_dev_password@localhost:5432/kla_dev?schema=public' });
const db = new PrismaClient({ adapter });
const rows = await db.enrollment.findMany({
  where: { user: { email: 'emily.chen@kirbycorp.com' } },
  include: { course: { select: { title: true } } },
});
rows.forEach(e => console.log(e.id, e.status, e.course.title));
await db.$disconnect();
