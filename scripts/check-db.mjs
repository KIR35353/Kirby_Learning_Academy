import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: 'postgresql://kla:kla_dev_password@localhost:5432/kla_dev?schema=public' });
const db = new PrismaClient({ adapter });

const [u, c, e, sc] = await Promise.all([
  db.user.count(), db.course.count(), db.enrollment.count(), db.skillCategory.count()
]);
console.log('users:', u, 'courses:', c, 'enrollments:', e, 'skillCategories:', sc);

if (u > 0) {
  const users = await db.user.findMany({ select: { email: true, tenantId: true }, take: 5 });
  console.log('Sample users:', users);
}
if (c > 0) {
  const courses = await db.course.findMany({ select: { title: true, status: true, tenantId: true }, take: 3 });
  console.log('Sample courses:', courses);
}

await db.$disconnect();
