/**
 * Prisma seed — creates default roles, tenant, admin user, and rich demo data.
 * Run: npx prisma db seed
 * Safe to re-run: upserts existing records, skips demo bulk data if already present.
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString = process.env["DATABASE_URL"];
if (!connectionString) throw new Error("DATABASE_URL is not set");
const adapter = new PrismaPg({ connectionString });
const db = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

const ROLES = [
  { name: "SUPER_ADMIN", description: "Full platform access across all tenants" },
  { name: "TENANT_ADMIN", description: "Admin for a single business unit" },
  { name: "MANAGER", description: "Assign courses and view team reports" },
  { name: "INSTRUCTOR", description: "Create and manage courses" },
  { name: "STUDENT", description: "Enroll in and complete courses" },
];

// Helper to add days to a date
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const subDays = (d: Date, n: number) => addDays(d, -n);
const now = new Date();

async function main() {
  console.log("🌱  Seeding database…");

  // ── 1. Roles ──────────────────────────────────────────────────────────────
  for (const role of ROLES) {
    await db.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role,
    });
  }
  console.log(`✔  ${ROLES.length} roles seeded`);

  // ── 2. Default tenant ─────────────────────────────────────────────────────
  const tenant = await db.tenant.upsert({
    where: { slug: "kirby-corp" },
    update: { domain: "kirbycorp.com" },
    create: { name: "Kirby Corporation", slug: "kirby-corp", domain: "kirbycorp.com" },
  });
  console.log(`✔  Tenant: ${tenant.name}`);

  // ── 3. Departments ────────────────────────────────────────────────────────
  const deptNames = [
    "Marine Operations",
    "Distribution & Services",
    "Safety & Compliance",
    "Information Technology",
    "Human Resources",
    "Finance",
    "Engineering",
    "Fleet Management",
  ];
  const depts: Record<string, { id: string }> = {};
  for (const name of deptNames) {
    depts[name] = await db.department.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name } },
      update: {},
      create: { name, tenantId: tenant.id },
    });
  }
  console.log(`✔  ${deptNames.length} departments seeded`);

  // ── 4. Locations ──────────────────────────────────────────────────────────
  const locationData = [
    { name: "Houston, TX HQ", city: "Houston", state: "TX" },
    { name: "New Orleans, LA", city: "New Orleans", state: "LA" },
    { name: "Tampa, FL", city: "Tampa", state: "FL" },
    { name: "Beaumont, TX", city: "Beaumont", state: "TX" },
    { name: "Port Arthur, TX", city: "Port Arthur", state: "TX" },
  ];
  const locs: Record<string, { id: string }> = {};
  for (const loc of locationData) {
    locs[loc.name] = await db.location.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: loc.name } },
      update: {},
      create: { ...loc, tenantId: tenant.id },
    });
  }
  console.log(`✔  ${locationData.length} locations seeded`);

  // ── 5. Job Titles ─────────────────────────────────────────────────────────
  const jobTitleNames = [
    "Marine Officer",
    "Deckhand",
    "Safety Inspector",
    "HR Manager",
    "IT Specialist",
    "Compliance Analyst",
    "Distribution Coordinator",
    "Engineer",
  ];
  const jobTitles: Record<string, { id: string }> = {};
  for (const name of jobTitleNames) {
    jobTitles[name] = await db.jobTitle.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name } },
      update: {},
      create: { name, tenantId: tenant.id },
    });
  }
  console.log(`✔  ${jobTitleNames.length} job titles seeded`);

  // ── 6. Admin user ─────────────────────────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@kirbycorp.com";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "KLA.adm1n";
  const adminHash = await bcrypt.hash(adminPassword, 12);
  const superAdminRole = await db.role.findUnique({ where: { name: "SUPER_ADMIN" } });

  const admin = await db.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash: adminHash, isActive: true },
    create: {
      email: adminEmail,
      name: "KLA Administrator",
      passwordHash: adminHash,
      tenantId: tenant.id,
      isActive: true,
      departmentId: depts["Information Technology"].id,
      jobTitleId: jobTitles["IT Specialist"].id,
    },
  });
  if (superAdminRole) {
    await db.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: superAdminRole.id } },
      update: {},
      create: { userId: admin.id, roleId: superAdminRole.id },
    });
  }
  console.log(`✔  Admin: ${admin.email} (password synced)`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log(`    ℹ  Default password "KLA.adm1n". Set ADMIN_PASSWORD to override.`);
  }

  // ── 7. Demo users ─────────────────────────────────────────────────────────
  const demoPassword = "KLA.demo1";
  const demoHash = await bcrypt.hash(demoPassword, 10);

  const demoUserDefs = [
    { email: "john.smith@kirbycorp.com",    name: "John Smith",       role: "MANAGER",            dept: "Marine Operations",       job: "Marine Officer",          location: "Houston, TX HQ"  },
    { email: "sarah.jones@kirbycorp.com",   name: "Sarah Jones",      role: "MANAGER",            dept: "Safety & Compliance",     job: "Compliance Analyst",      location: "Houston, TX HQ"  },
    { email: "mike.wilson@kirbycorp.com",   name: "Mike Wilson",      role: "INSTRUCTOR",         dept: "Marine Operations",       job: "Marine Officer",          location: "New Orleans, LA" },
    { email: "emily.chen@kirbycorp.com",    name: "Emily Chen",       role: "STUDENT",            dept: "Marine Operations",       job: "Deckhand",                location: "Houston, TX HQ"  },
    { email: "carlos.martinez@kirbycorp.com", name: "Carlos Martinez", role: "STUDENT",           dept: "Distribution & Services", job: "Distribution Coordinator", location: "Tampa, FL"      },
    { email: "lisa.taylor@kirbycorp.com",   name: "Lisa Taylor",      role: "STUDENT",            dept: "Marine Operations",       job: "Deckhand",                location: "New Orleans, LA" },
    { email: "david.brown@kirbycorp.com",   name: "David Brown",      role: "STUDENT",            dept: "Information Technology",  job: "IT Specialist",           location: "Houston, TX HQ"  },
    { email: "jessica.davis@kirbycorp.com", name: "Jessica Davis",    role: "STUDENT",            dept: "Human Resources",         job: "HR Manager",              location: "Houston, TX HQ"  },
    { email: "robert.johnson@kirbycorp.com",name: "Robert Johnson",   role: "STUDENT",            dept: "Marine Operations",       job: "Deckhand",                location: "Beaumont, TX",   isContractor: true },
    { email: "thomas.williams@kirbycorp.com",name:"Thomas Williams",  role: "STUDENT",            dept: "Safety & Compliance",     job: "Safety Inspector",        location: "Port Arthur, TX" },
    { email: "jennifer.miller@kirbycorp.com",name:"Jennifer Miller",  role: "STUDENT",            dept: "Engineering",             job: "Engineer",                location: "Houston, TX HQ"  },
  ] as const;

  const users: Record<string, { id: string; name: string | null }> = { [admin.email]: admin };
  for (const u of demoUserDefs) {
    const roleRec = await db.role.findUnique({ where: { name: u.role } });
    const created = await db.user.upsert({
      where: { email: u.email },
      update: { isActive: true },
      create: {
        email: u.email,
        name: u.name,
        passwordHash: demoHash,
        tenantId: tenant.id,
        isActive: true,
        isContractor: "isContractor" in u ? u.isContractor : false,
        departmentId: depts[u.dept]?.id,
        jobTitleId: jobTitles[u.job]?.id,
        locationId: locs[u.location]?.id,
        hireDate: subDays(now, Math.floor(Math.random() * 730 + 30)),
      },
    });
    if (roleRec) {
      await db.userRole.upsert({
        where: { userId_roleId: { userId: created.id, roleId: roleRec.id } },
        update: {},
        create: { userId: created.id, roleId: roleRec.id },
      });
    }
    users[u.email] = created;
  }
  console.log(`✔  ${demoUserDefs.length + 1} users seeded (demo password: "${demoPassword}")`);

  // ── Guard: skip bulk demo data if already present ─────────────────────────
  const alreadySeeded = await db.course.findFirst({ where: { tenantId: tenant.id } });
  if (alreadySeeded) {
    console.log("ℹ  Course data already exists — skipping bulk demo data.");
    console.log("\n✅  Seed complete.");
    return;
  }

  // ── 8. Courses ────────────────────────────────────────────────────────────
  const courseDefs = [
    {
      title: "OSHA 30-Hour Maritime Safety",
      description: "Comprehensive OSHA maritime safety training covering hazard recognition, fall protection, electrical safety, and personal protective equipment requirements for maritime workers.",
      category: "Safety",
      objectives: ["Identify maritime workplace hazards", "Apply OSHA regulations to vessel operations", "Use PPE correctly", "Report and document safety incidents"],
      duration: 1800,
      complianceTags: ["OSHA", "Maritime"],
      targetAudience: "All marine operations personnel",
    },
    {
      title: "USCG Basic Safety Training",
      description: "Coast Guard-mandated basic safety training covering personal survival techniques, fire prevention, elementary first aid, and personal safety and social responsibility.",
      category: "Compliance",
      objectives: ["Perform personal survival techniques", "Respond to vessel emergencies", "Administer basic first aid", "Demonstrate fire prevention procedures"],
      duration: 240,
      complianceTags: ["USCG", "Maritime", "STCW"],
      targetAudience: "Seafarers and marine personnel",
    },
    {
      title: "Environmental Compliance for Marine Operations",
      description: "Training on EPA regulations, spill prevention and response, ballast water management, and environmental stewardship in marine operations.",
      category: "Compliance",
      objectives: ["Understand EPA marine regulations", "Execute spill response plans", "Manage ballast water correctly", "Document environmental incidents"],
      duration: 90,
      complianceTags: ["EPA", "Maritime", "Environmental"],
      targetAudience: "Marine operations and fleet management",
    },
    {
      title: "Hazardous Materials Handling",
      description: "OSHA-compliant HazMat training covering identification, safe handling, storage, transport, and emergency response for hazardous materials.",
      category: "Safety",
      objectives: ["Identify HazMat classifications", "Read and interpret SDS sheets", "Apply safe handling procedures", "Respond to HazMat incidents"],
      duration: 120,
      complianceTags: ["OSHA", "HazMat", "DOT"],
      targetAudience: "Distribution and marine operations personnel",
    },
    {
      title: "Emergency Response Procedures",
      description: "Comprehensive emergency response training including evacuation procedures, fire fighting, man overboard response, and crisis communications.",
      category: "Safety",
      objectives: ["Execute evacuation procedures", "Use firefighting equipment", "Respond to man overboard situations", "Communicate during emergencies"],
      duration: 180,
      complianceTags: ["OSHA", "USCG", "Maritime"],
      targetAudience: "All vessel crew members",
    },
    {
      title: "Data Security & Cyber Awareness",
      description: "Cybersecurity fundamentals covering phishing recognition, password hygiene, data handling, incident reporting, and maritime OT/IT security considerations.",
      category: "Technology",
      objectives: ["Recognize phishing attempts", "Create and manage strong passwords", "Handle sensitive data correctly", "Report security incidents"],
      duration: 60,
      complianceTags: ["IT", "Security", "NIST"],
      targetAudience: "All employees",
      isContractorVisible: true,
    },
  ];

  const courses: { id: string; title: string }[] = [];
  for (const c of courseDefs) {
    const course = await db.course.create({
      data: {
        ...c,
        tenantId: tenant.id,
        status: "PUBLISHED",
        createdById: admin.id,
        isContractorVisible: "isContractorVisible" in c ? c.isContractorVisible : false,
      },
    });
    // Create a stub version for each course
    const version = await db.courseVersion.create({
      data: {
        courseId: course.id,
        versionNumber: 1,
        s3Prefix: `courses/${course.id}/v1/`,
        manifestSnapshot: { title: c.title, version: 1, sections: Math.floor(c.duration / 30) },
        originalFileName: `${c.title.toLowerCase().replace(/\s+/g, "-")}-v1.zip`,
        fileSizeBytes: Math.floor(Math.random() * 50_000_000 + 5_000_000),
        uploadedById: admin.id,
      },
    });
    await db.course.update({ where: { id: course.id }, data: { activeVersionId: version.id } });
    courses.push(course);
  }
  console.log(`✔  ${courses.length} courses seeded`);

  // ── 9. Learning Paths ─────────────────────────────────────────────────────
  const pathMaritime = await db.learningPath.create({
    data: {
      tenantId: tenant.id,
      title: "Maritime Safety Fundamentals",
      description: "Core safety training required for all marine operations personnel. Covers OSHA standards, USCG requirements, and emergency procedures.",
      isActive: true,
      courses: {
        create: [
          { courseId: courses[0].id, order: 1, isRequired: true },
          { courseId: courses[1].id, order: 2, isRequired: true, prerequisiteCourseId: courses[0].id },
          { courseId: courses[4].id, order: 3, isRequired: true, prerequisiteCourseId: courses[1].id },
        ],
      },
    },
  });

  const pathOnboarding = await db.learningPath.create({
    data: {
      tenantId: tenant.id,
      title: "New Employee Onboarding",
      description: "Essential training for all new Kirby Corporation employees covering HazMat safety, data security, and environmental compliance.",
      isActive: true,
      courses: {
        create: [
          { courseId: courses[5].id, order: 1, isRequired: true },
          { courseId: courses[3].id, order: 2, isRequired: true },
          { courseId: courses[2].id, order: 3, isRequired: false },
        ],
      },
    },
  });
  console.log(`✔  2 learning paths seeded`);

  // ── 10. Curriculum ────────────────────────────────────────────────────────
  const curriculum = await db.curriculum.create({
    data: {
      tenantId: tenant.id,
      title: "Marine Operations Onboarding Curriculum",
      description: "Complete onboarding program for marine operations personnel including safety fundamentals and general employee orientation.",
      isActive: true,
      paths: {
        create: [
          { learningPathId: pathMaritime.id, order: 1 },
          { learningPathId: pathOnboarding.id, order: 2 },
        ],
      },
    },
  });

  // Assign curriculum to Marine Operations department
  await db.curriculumAssignment.create({
    data: {
      curriculumId: curriculum.id,
      tenantId: tenant.id,
      departmentId: depts["Marine Operations"].id,
      assignedById: admin.id,
      dueDate: addDays(now, 90),
    },
  });
  console.log(`✔  1 curriculum seeded`);

  // ── 11. Standalone Assessments ────────────────────────────────────────────
  const attestation = await db.standaloneAssessment.create({
    data: {
      tenantId: tenant.id,
      title: "Annual Safety Policy Attestation",
      description: "Annual acknowledgment that all personnel have read, understood, and agree to comply with the Kirby Corporation Safety Policy.",
      type: "ATTESTATION",
      status: "PUBLISHED",
      passingScore: 100,
      maxAttempts: 3,
      createdById: admin.id,
      questions: {
        create: [
          {
            type: "ATTESTATION",
            text: "I have read and understood the Kirby Corporation Safety Policy (Rev. 2026-01) and agree to comply with all requirements in my daily work activities.",
            points: 1,
            order: 1,
            options: { create: [{ text: "I acknowledge and agree", isCorrect: true, order: 1 }] },
          },
          {
            type: "ATTESTATION",
            text: "I understand that non-compliance with safety policies may result in disciplinary action up to and including termination of employment.",
            points: 1,
            order: 2,
            options: { create: [{ text: "I acknowledge and agree", isCorrect: true, order: 1 }] },
          },
        ],
      },
    },
  });

  const hazmatQuiz = await db.standaloneAssessment.create({
    data: {
      tenantId: tenant.id,
      title: "HazMat Knowledge Check",
      description: "Verify foundational knowledge of hazardous materials handling before assigning full HazMat Handling course completion.",
      type: "QUIZ",
      status: "PUBLISHED",
      passingScore: 80,
      maxAttempts: 2,
      timeLimitMinutes: 30,
      remediationCourseId: courses[3].id,
      createdById: admin.id,
      questions: {
        create: [
          {
            type: "MULTIPLE_CHOICE",
            text: "What does SDS stand for in the context of hazardous materials?",
            points: 2,
            order: 1,
            explanation: "SDS stands for Safety Data Sheet, formerly known as Material Safety Data Sheet (MSDS).",
            options: {
              create: [
                { text: "Safety Data Sheet",            isCorrect: true,  order: 1 },
                { text: "Standard Disposal Sheet",      isCorrect: false, order: 2 },
                { text: "Substance Disclosure Summary", isCorrect: false, order: 3 },
                { text: "Safe Delivery Schedule",       isCorrect: false, order: 4 },
              ],
            },
          },
          {
            type: "TRUE_FALSE",
            text: "It is acceptable to store incompatible chemicals in the same cabinet as long as they are in sealed containers.",
            points: 2,
            order: 2,
            explanation: "Incompatible chemicals must always be stored separately, regardless of container integrity.",
            options: {
              create: [
                { text: "True",  isCorrect: false, order: 1 },
                { text: "False", isCorrect: true,  order: 2 },
              ],
            },
          },
          {
            type: "MULTIPLE_CHOICE",
            text: "Which DOT placard is required for flammable liquids?",
            points: 2,
            order: 3,
            explanation: "Flammable liquids use a red diamond-shaped placard with the number 3.",
            options: {
              create: [
                { text: "Red diamond (Class 3)",        isCorrect: true,  order: 1 },
                { text: "Yellow diamond (Class 5)",     isCorrect: false, order: 2 },
                { text: "White square (Class 6)",       isCorrect: false, order: 3 },
                { text: "Orange rectangle (Class 1)",   isCorrect: false, order: 4 },
              ],
            },
          },
          {
            type: "MULTI_SELECT",
            text: "Which of the following are required elements of a spill response plan? (Select all that apply)",
            points: 3,
            order: 4,
            explanation: "A complete spill response plan includes notification procedures, containment steps, cleanup procedures, and documentation requirements.",
            options: {
              create: [
                { text: "Notification procedures",         isCorrect: true,  order: 1 },
                { text: "Containment procedures",          isCorrect: true,  order: 2 },
                { text: "Color-coding of containers",      isCorrect: false, order: 3 },
                { text: "Cleanup and disposal procedures", isCorrect: true,  order: 4 },
                { text: "Documentation and reporting",     isCorrect: true,  order: 5 },
              ],
            },
          },
          {
            type: "MULTIPLE_CHOICE",
            text: "When must you consult an SDS for a hazardous material?",
            points: 1,
            order: 5,
            explanation: "SDS sheets must be consulted before first use and whenever there is a change in handling procedures.",
            options: {
              create: [
                { text: "Before first use and when procedures change", isCorrect: true,  order: 1 },
                { text: "Only when there is an incident",              isCorrect: false, order: 2 },
                { text: "Once per year during safety audits",          isCorrect: false, order: 3 },
                { text: "SDS consultation is optional",                isCorrect: false, order: 4 },
              ],
            },
          },
        ],
      },
    },
  });

  // Assign attestation to all employees
  await db.assessmentAssignment.create({
    data: {
      assessmentId: attestation.id,
      tenantId: tenant.id,
      roleName: "EMPLOYEE",
      dueDate: addDays(now, 30),
      assignedById: admin.id,
    },
  });
  console.log(`✔  2 standalone assessments seeded`);

  // ── 12. Enrollments ───────────────────────────────────────────────────────
  type EnrollDef = { email: string; courseTitle: string; status: string; score?: number; passed?: boolean; daysAgo?: number };
  const enrollDefs: EnrollDef[] = [
    // Emily Chen — active marine employee, well progressed
    { email: "emily.chen@kirbycorp.com",     courseTitle: "OSHA 30-Hour Maritime Safety",        status: "PASSED",      score: 92, passed: true,  daysAgo: 45 },
    { email: "emily.chen@kirbycorp.com",     courseTitle: "USCG Basic Safety Training",           status: "PASSED",      score: 88, passed: true,  daysAgo: 30 },
    { email: "emily.chen@kirbycorp.com",     courseTitle: "Emergency Response Procedures",        status: "IN_PROGRESS", daysAgo: 5 },
    { email: "emily.chen@kirbycorp.com",     courseTitle: "Hazardous Materials Handling",         status: "NOT_STARTED" },
    { email: "emily.chen@kirbycorp.com",     courseTitle: "Data Security & Cyber Awareness",      status: "PASSED",      score: 95, passed: true,  daysAgo: 60 },

    // Lisa Taylor — some complete, one overdue
    { email: "lisa.taylor@kirbycorp.com",    courseTitle: "OSHA 30-Hour Maritime Safety",         status: "PASSED",      score: 85, passed: true,  daysAgo: 90 },
    { email: "lisa.taylor@kirbycorp.com",    courseTitle: "USCG Basic Safety Training",           status: "IN_PROGRESS", daysAgo: 20 },
    { email: "lisa.taylor@kirbycorp.com",    courseTitle: "Emergency Response Procedures",        status: "NOT_STARTED" },

    // Thomas Williams — safety compliance focus
    { email: "thomas.williams@kirbycorp.com", courseTitle: "OSHA 30-Hour Maritime Safety",       status: "PASSED",      score: 96, passed: true,  daysAgo: 120 },
    { email: "thomas.williams@kirbycorp.com", courseTitle: "Environmental Compliance for Marine Operations", status: "PASSED", score: 91, passed: true, daysAgo: 60 },
    { email: "thomas.williams@kirbycorp.com", courseTitle: "Hazardous Materials Handling",       status: "PASSED",      score: 78, passed: false, daysAgo: 14 },

    // Jennifer Miller — engineer
    { email: "jennifer.miller@kirbycorp.com", courseTitle: "OSHA 30-Hour Maritime Safety",       status: "PASSED",      score: 89, passed: true,  daysAgo: 55 },
    { email: "jennifer.miller@kirbycorp.com", courseTitle: "Emergency Response Procedures",      status: "PASSED",      score: 93, passed: true,  daysAgo: 40 },
    { email: "jennifer.miller@kirbycorp.com", courseTitle: "Data Security & Cyber Awareness",    status: "NOT_STARTED" },

    // Carlos Martinez — distribution
    { email: "carlos.martinez@kirbycorp.com", courseTitle: "Hazardous Materials Handling",       status: "PASSED",      score: 82, passed: true,  daysAgo: 70 },
    { email: "carlos.martinez@kirbycorp.com", courseTitle: "Data Security & Cyber Awareness",    status: "IN_PROGRESS", daysAgo: 3 },

    // David Brown — IT
    { email: "david.brown@kirbycorp.com",    courseTitle: "Data Security & Cyber Awareness",     status: "PASSED",      score: 98, passed: true,  daysAgo: 80 },
    { email: "david.brown@kirbycorp.com",    courseTitle: "OSHA 30-Hour Maritime Safety",        status: "NOT_STARTED" },

    // Jessica Davis — HR
    { email: "jessica.davis@kirbycorp.com",  courseTitle: "Data Security & Cyber Awareness",     status: "PASSED",      score: 91, passed: true,  daysAgo: 50 },
    { email: "jessica.davis@kirbycorp.com",  courseTitle: "Hazardous Materials Handling",        status: "IN_PROGRESS", daysAgo: 7 },

    // Robert Johnson — contractor
    { email: "robert.johnson@kirbycorp.com", courseTitle: "Data Security & Cyber Awareness",     status: "PASSED",      score: 87, passed: true,  daysAgo: 20 },
  ];

  let enrollCount = 0;
  const courseMap = Object.fromEntries(courses.map((c) => [c.title, c.id]));
  for (const e of enrollDefs) {
    const userId = users[e.email]?.id;
    const courseId = courseMap[e.courseTitle];
    if (!userId || !courseId) continue;
    const daysAgo = e.daysAgo ?? 0;
    await db.enrollment.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: {},
      create: {
        userId,
        courseId,
        tenantId: tenant.id,
        status: e.status as never,
        score: e.score ?? null,
        passed: e.passed ?? null,
        selfEnrolled: false,
        assignedById: admin.id,
        startedAt: e.status !== "NOT_STARTED" ? subDays(now, daysAgo) : null,
        completedAt: (e.status === "PASSED" || e.status === "FAILED") ? subDays(now, Math.max(1, daysAgo - 2)) : null,
        dueDate: addDays(now, 30),
        attempts: e.status === "NOT_STARTED" ? 0 : 1,
      },
    });
    enrollCount++;
  }
  console.log(`✔  ${enrollCount} enrollments seeded`);

  // ── 13. Assessment Attempts ───────────────────────────────────────────────
  // Emily completes the attestation
  await db.assessmentAttempt.create({
    data: {
      assessmentId: attestation.id,
      userId: users["emily.chen@kirbycorp.com"].id,
      tenantId: tenant.id,
      status: "PASSED",
      score: 100,
      passed: true,
      startedAt: subDays(now, 5),
      submittedAt: subDays(now, 5),
    },
  });
  // Thomas passes the HazMat quiz
  await db.assessmentAttempt.create({
    data: {
      assessmentId: hazmatQuiz.id,
      userId: users["thomas.williams@kirbycorp.com"].id,
      tenantId: tenant.id,
      status: "FAILED",
      score: 60,
      passed: false,
      startedAt: subDays(now, 10),
      submittedAt: subDays(now, 10),
    },
  });
  await db.assessmentAttempt.create({
    data: {
      assessmentId: hazmatQuiz.id,
      userId: users["carlos.martinez@kirbycorp.com"].id,
      tenantId: tenant.id,
      status: "PASSED",
      score: 83,
      passed: true,
      startedAt: subDays(now, 2),
      submittedAt: subDays(now, 2),
    },
  });
  console.log(`✔  3 assessment attempts seeded`);

  // ── 14. Skills ────────────────────────────────────────────────────────────
  const safetyCategory = await db.skillCategory.create({
    data: { tenantId: tenant.id, name: "Safety & Compliance" },
  });
  const techCategory = await db.skillCategory.create({
    data: { tenantId: tenant.id, name: "Technical Operations" },
  });
  const coreCategory = await db.skillCategory.create({
    data: { tenantId: tenant.id, name: "Core Business" },
  });

  const skillDefs = [
    { name: "OSHA Maritime Safety",      categoryId: safetyCategory.id, levelLabels: ["Awareness", "Developing", "Proficient", "Advanced", "Expert"] },
    { name: "Maritime Regulations",      categoryId: safetyCategory.id, levelLabels: ["Awareness", "Developing", "Proficient", "Advanced", "Expert"] },
    { name: "Emergency Response",        categoryId: safetyCategory.id, levelLabels: ["Basic", "Intermediate", "Advanced", "Expert"] },
    { name: "HazMat Handling",           categoryId: safetyCategory.id, levelLabels: ["Awareness", "Certified", "Advanced Handler", "Instructor"] },
    { name: "Environmental Compliance",  categoryId: safetyCategory.id, levelLabels: ["Awareness", "Developing", "Proficient"] },
    { name: "Vessel Operations",         categoryId: techCategory.id,   levelLabels: ["Trainee", "Junior", "Qualified", "Senior", "Expert"] },
    { name: "Equipment Maintenance",     categoryId: techCategory.id,   levelLabels: ["Basic", "Intermediate", "Advanced"] },
    { name: "Navigation",                categoryId: techCategory.id,   levelLabels: ["Basic", "Intermediate", "Advanced", "Expert"] },
    { name: "Data Security",             categoryId: coreCategory.id,   levelLabels: ["Awareness", "Practitioner", "Advanced"] },
    { name: "Communication",             categoryId: coreCategory.id,   levelLabels: ["Developing", "Effective", "Advanced", "Expert"] },
    { name: "Leadership",                categoryId: coreCategory.id,   levelLabels: ["Developing", "Effective", "Advanced", "Expert"] },
  ];

  const skills: Record<string, { id: string }> = {};
  for (const s of skillDefs) {
    skills[s.name] = await db.skill.create({
      data: { ...s, tenantId: tenant.id },
    });
  }
  console.log(`✔  ${skillDefs.length} skills seeded in 3 categories`);

  // Course → skill grants
  const courseSkillMappings = [
    { courseTitle: "OSHA 30-Hour Maritime Safety",        skillName: "OSHA Maritime Safety",     levelGrant: 3 },
    { courseTitle: "OSHA 30-Hour Maritime Safety",        skillName: "Maritime Regulations",     levelGrant: 2 },
    { courseTitle: "USCG Basic Safety Training",          skillName: "Maritime Regulations",     levelGrant: 3 },
    { courseTitle: "Emergency Response Procedures",       skillName: "Emergency Response",       levelGrant: 2 },
    { courseTitle: "Hazardous Materials Handling",        skillName: "HazMat Handling",          levelGrant: 2 },
    { courseTitle: "Environmental Compliance for Marine Operations", skillName: "Environmental Compliance", levelGrant: 2 },
    { courseTitle: "Data Security & Cyber Awareness",    skillName: "Data Security",             levelGrant: 1 },
  ];
  for (const m of courseSkillMappings) {
    const courseId = courseMap[m.courseTitle];
    const skillId = skills[m.skillName]?.id;
    if (courseId && skillId) {
      await db.courseSkill.create({ data: { courseId, skillId, levelGrant: m.levelGrant } });
    }
  }

  // Role skill requirements for Marine Officer
  const marineOfficerJobTitleId = jobTitles["Marine Officer"]?.id;
  if (marineOfficerJobTitleId) {
    const marineReqs = [
      { skillName: "OSHA Maritime Safety",  requiredLevel: 3 },
      { skillName: "Maritime Regulations",  requiredLevel: 3 },
      { skillName: "Emergency Response",    requiredLevel: 2 },
      { skillName: "Vessel Operations",     requiredLevel: 3 },
      { skillName: "Leadership",            requiredLevel: 2 },
    ];
    for (const r of marineReqs) {
      const skillId = skills[r.skillName]?.id;
      if (skillId) {
        await db.roleSkillRequirement.create({
          data: { jobTitleId: marineOfficerJobTitleId, skillId, requiredLevel: r.requiredLevel },
        });
      }
    }
  }

  // User skills (based on passed enrollments)
  const userSkillGrants = [
    { email: "emily.chen@kirbycorp.com",     skillName: "OSHA Maritime Safety",    level: 3, source: "course_completion" },
    { email: "emily.chen@kirbycorp.com",     skillName: "Maritime Regulations",    level: 2, source: "course_completion" },
    { email: "emily.chen@kirbycorp.com",     skillName: "Data Security",           level: 1, source: "course_completion" },
    { email: "thomas.williams@kirbycorp.com",skillName: "OSHA Maritime Safety",    level: 3, source: "course_completion" },
    { email: "thomas.williams@kirbycorp.com",skillName: "Environmental Compliance",level: 2, source: "course_completion" },
    { email: "jennifer.miller@kirbycorp.com",skillName: "OSHA Maritime Safety",    level: 3, source: "course_completion" },
    { email: "jennifer.miller@kirbycorp.com",skillName: "Emergency Response",      level: 2, source: "course_completion" },
    { email: "carlos.martinez@kirbycorp.com",skillName: "HazMat Handling",         level: 2, source: "course_completion" },
    { email: "carlos.martinez@kirbycorp.com",skillName: "Data Security",           level: 1, source: "course_completion" },
    { email: "john.smith@kirbycorp.com",     skillName: "Leadership",              level: 3, source: "manual", endorsedEmail: "admin@kirbycorp.com" },
    { email: "john.smith@kirbycorp.com",     skillName: "Maritime Regulations",    level: 4, source: "manual", endorsedEmail: "admin@kirbycorp.com" },
  ];
  for (const g of userSkillGrants) {
    const userId = users[g.email]?.id;
    const skillId = skills[g.skillName]?.id;
    if (!userId || !skillId) continue;
    const endorsedById = "endorsedEmail" in g ? users[(g as { endorsedEmail: string }).endorsedEmail]?.id : undefined;
    await db.userSkill.upsert({
      where: { userId_skillId: { userId, skillId } },
      update: {},
      create: { userId, skillId, level: g.level, source: g.source, endorsedById: endorsedById ?? null },
    });
  }
  console.log(`✔  Skills, course-skill mappings, role requirements, and user skills seeded`);

  // ── 15. Certifications ────────────────────────────────────────────────────
  const certDefs = [
    { name: "OSHA 30-Hour Maritime Certificate", framework: "OSHA", validityDays: 1095, renewalCourseTitle: "OSHA 30-Hour Maritime Safety" },
    { name: "USCG Basic Safety Certificate",     framework: "USCG", validityDays: 1825, renewalCourseTitle: "USCG Basic Safety Training" },
    { name: "EPA Environmental Compliance",      framework: "EPA",  validityDays: 365,  renewalCourseTitle: "Environmental Compliance for Marine Operations" },
    { name: "DOT HazMat Handler",               framework: "OSHA", validityDays: 730,  renewalCourseTitle: "Hazardous Materials Handling" },
    { name: "Emergency Response Certification", framework: "INTERNAL", validityDays: 365, renewalCourseTitle: "Emergency Response Procedures" },
  ] as const;

  const certs: Record<string, { id: string }> = {};
  for (const c of certDefs) {
    const renewalCourseId = courseMap[c.renewalCourseTitle];
    certs[c.name] = await db.certification.create({
      data: {
        tenantId: tenant.id,
        name: c.name,
        framework: c.framework as never,
        validityDays: c.validityDays,
        renewalCourseId: renewalCourseId ?? null,
        isActive: true,
      },
    });
  }

  // Certification records for users
  const certRecordDefs = [
    { email: "emily.chen@kirbycorp.com",      certName: "OSHA 30-Hour Maritime Certificate", status: "VALID",          issuedDaysAgo: 45,  validForDays: 1095 },
    { email: "emily.chen@kirbycorp.com",      certName: "USCG Basic Safety Certificate",     status: "VALID",          issuedDaysAgo: 30,  validForDays: 1825 },
    { email: "thomas.williams@kirbycorp.com", certName: "OSHA 30-Hour Maritime Certificate", status: "VALID",          issuedDaysAgo: 120, validForDays: 1095 },
    { email: "thomas.williams@kirbycorp.com", certName: "EPA Environmental Compliance",      status: "EXPIRING_SOON",  issuedDaysAgo: 340, validForDays: 365 },
    { email: "lisa.taylor@kirbycorp.com",     certName: "OSHA 30-Hour Maritime Certificate", status: "EXPIRING_SOON",  issuedDaysAgo: 1020, validForDays: 1095 },
    { email: "jennifer.miller@kirbycorp.com", certName: "OSHA 30-Hour Maritime Certificate", status: "VALID",          issuedDaysAgo: 55,  validForDays: 1095 },
    { email: "jennifer.miller@kirbycorp.com", certName: "Emergency Response Certification",  status: "VALID",          issuedDaysAgo: 40,  validForDays: 365 },
    { email: "robert.johnson@kirbycorp.com",  certName: "DOT HazMat Handler",               status: "EXPIRED",        issuedDaysAgo: 780, validForDays: 730 },
    { email: "carlos.martinez@kirbycorp.com", certName: "DOT HazMat Handler",               status: "VALID",          issuedDaysAgo: 70,  validForDays: 730 },
    { email: "john.smith@kirbycorp.com",      certName: "OSHA 30-Hour Maritime Certificate", status: "VALID",          issuedDaysAgo: 200, validForDays: 1095 },
    { email: "john.smith@kirbycorp.com",      certName: "USCG Basic Safety Certificate",     status: "VALID",          issuedDaysAgo: 180, validForDays: 1825 },
  ];

  for (const r of certRecordDefs) {
    const userId = users[r.email]?.id;
    const certId = certs[r.certName]?.id;
    if (!userId || !certId) continue;
    const issuedAt = subDays(now, r.issuedDaysAgo);
    const expiresAt = addDays(issuedAt, r.validForDays);
    const record = await db.certificationRecord.create({
      data: {
        certificationId: certId,
        userId,
        tenantId: tenant.id,
        status: r.status as never,
        issuedAt,
        expiresAt,
        source: "course_completion",
        issuedById: admin.id,
      },
    });
    await db.certificationHistory.create({
      data: {
        recordId: record.id,
        toStatus: r.status as never,
        changedAt: issuedAt,
        changedById: admin.id,
        reason: "Initial issuance after course completion",
      },
    });
  }
  console.log(`✔  ${certDefs.length} certifications, ${certRecordDefs.length} records seeded`);

  // Compliance requirements
  await db.complianceRequirement.create({
    data: {
      tenantId: tenant.id,
      certificationId: certs["OSHA 30-Hour Maritime Certificate"].id,
      scope: "JOB_TITLE",
      scopeId: jobTitles["Marine Officer"].id,
      isActive: true,
    },
  });
  await db.complianceRequirement.create({
    data: {
      tenantId: tenant.id,
      certificationId: certs["OSHA 30-Hour Maritime Certificate"].id,
      scope: "JOB_TITLE",
      scopeId: jobTitles["Deckhand"].id,
      isActive: true,
    },
  });
  await db.complianceRequirement.create({
    data: {
      tenantId: tenant.id,
      certificationId: certs["DOT HazMat Handler"].id,
      scope: "DEPARTMENT",
      scopeId: depts["Distribution & Services"].id,
      isActive: true,
    },
  });

  // Audit log entries
  await db.auditLog.createMany({
    data: [
      { tenantId: tenant.id, action: "CERT_ISSUED",  actorId: admin.id, targetId: users["emily.chen@kirbycorp.com"].id, entityType: "CertificationRecord", ipAddress: "10.111.10.100", createdAt: subDays(now, 45) },
      { tenantId: tenant.id, action: "CERT_ISSUED",  actorId: admin.id, targetId: users["thomas.williams@kirbycorp.com"].id, entityType: "CertificationRecord", ipAddress: "10.111.10.100", createdAt: subDays(now, 120) },
      { tenantId: tenant.id, action: "CERT_EXPIRED", actorId: admin.id, targetId: users["robert.johnson@kirbycorp.com"].id, entityType: "CertificationRecord", ipAddress: "10.111.10.1",   createdAt: subDays(now, 50) },
      { tenantId: tenant.id, action: "REQUIREMENT_CREATED", actorId: admin.id, entityType: "ComplianceRequirement", ipAddress: "10.111.10.100", createdAt: subDays(now, 180) },
    ],
  });
  console.log(`✔  Compliance requirements and audit logs seeded`);

  // ── 16. Notifications ─────────────────────────────────────────────────────
  const notifDefs = [
    { email: "emily.chen@kirbycorp.com",      type: "COURSE_ASSIGNED",  title: "New Course Assigned", body: "You have been assigned 'Emergency Response Procedures'. Due in 30 days.", link: "/my-courses", daysAgo: 5  },
    { email: "emily.chen@kirbycorp.com",      type: "COURSE_COMPLETED", title: "Course Completed",    body: "Congratulations! You passed 'OSHA 30-Hour Maritime Safety' with a score of 92%.", link: "/my-courses", daysAgo: 45 },
    { email: "emily.chen@kirbycorp.com",      type: "CERT_ISSUED",      title: "Certificate Issued",  body: "Your OSHA 30-Hour Maritime Certificate has been issued.", link: "/profile", daysAgo: 45 },
    { email: "lisa.taylor@kirbycorp.com",     type: "CERT_EXPIRING",    title: "Certificate Expiring Soon", body: "Your OSHA 30-Hour Maritime Certificate expires in 75 days. Renewal training is available.", link: "/my-courses", daysAgo: 1  },
    { email: "lisa.taylor@kirbycorp.com",     type: "COURSE_DUE_SOON",  title: "Course Due Soon",     body: "'USCG Basic Safety Training' is due in 10 days.", link: "/my-courses", daysAgo: 3  },
    { email: "thomas.williams@kirbycorp.com", type: "CERT_EXPIRING",    title: "Certificate Expiring Soon", body: "Your EPA Environmental Compliance certificate expires in 25 days.", link: "/my-courses", daysAgo: 2  },
    { email: "robert.johnson@kirbycorp.com",  type: "CERT_EXPIRED",     title: "Certificate Expired", body: "Your DOT HazMat Handler certificate has expired. Please complete renewal training.", link: "/my-courses", daysAgo: 50 },
    { email: "carlos.martinez@kirbycorp.com", type: "COURSE_ASSIGNED",  title: "New Course Assigned", body: "You have been assigned 'Data Security & Cyber Awareness'.", link: "/my-courses", daysAgo: 3  },
    { email: "john.smith@kirbycorp.com",      type: "BROADCAST",        title: "Q2 Safety Training Reminder", body: "All marine operations personnel must complete their Q2 safety training by June 30, 2026.", link: "/my-courses", daysAgo: 7  },
    { email: "david.brown@kirbycorp.com",     type: "ASSESSMENT_ASSIGNED", title: "Assessment Assigned", body: "Annual Safety Policy Attestation is due by end of month.", link: "/assessments", daysAgo: 5  },
  ];

  for (const n of notifDefs) {
    const userId = users[n.email]?.id;
    if (!userId) continue;
    await db.notification.create({
      data: {
        tenantId: tenant.id,
        userId,
        type: n.type as never,
        title: n.title,
        body: n.body,
        link: n.link,
        isRead: n.daysAgo > 10,
        createdAt: subDays(now, n.daysAgo),
      },
    });
  }
  console.log(`✔  ${notifDefs.length} notifications seeded`);

  // ── 17. Badges ────────────────────────────────────────────────────────────
  const badgeDefs = [
    { name: "First Steps",         trigger: "COURSE_COMPLETED",        points: 10, description: "Awarded for completing your first course." },
    { name: "Safety Champion",     trigger: "COMPLIANCE_CHAMPION",     points: 50, description: "Awarded to employees with 100% compliance across all required certifications." },
    { name: "Quick Learner",       trigger: "STREAK_7",                points: 25, description: "Complete a course every day for 7 consecutive days." },
    { name: "Assessment Ace",      trigger: "ASSESSMENT_PASSED",       points: 20, description: "Pass a standalone assessment on the first attempt." },
    { name: "Path Pioneer",        trigger: "PATH_COMPLETED",          points: 30, description: "Complete an entire learning path." },
    { name: "Curriculum Graduate", trigger: "CURRICULUM_COMPLETED",    points: 75, description: "Complete all courses in an assigned curriculum." },
  ];

  const badges: Record<string, { id: string }> = {};
  for (const b of badgeDefs) {
    badges[b.name] = await db.badge.create({
      data: {
        tenantId: tenant.id,
        name: b.name,
        description: b.description,
        trigger: b.trigger as never,
        points: b.points,
        isActive: true,
      },
    });
  }

  // Award some badges to users
  const badgeAwards = [
    { email: "emily.chen@kirbycorp.com",      badgeName: "First Steps",     reason: "Completed first course: OSHA 30-Hour Maritime Safety", daysAgo: 45 },
    { email: "emily.chen@kirbycorp.com",      badgeName: "Assessment Ace",  reason: "Passed Annual Safety Policy Attestation on first attempt", daysAgo: 5  },
    { email: "thomas.williams@kirbycorp.com", badgeName: "First Steps",     reason: "Completed first course: OSHA 30-Hour Maritime Safety", daysAgo: 120 },
    { email: "thomas.williams@kirbycorp.com", badgeName: "Safety Champion", reason: "Achieved 100% compliance for Q1 2026", daysAgo: 30  },
    { email: "carlos.martinez@kirbycorp.com", badgeName: "First Steps",     reason: "Completed first course: Hazardous Materials Handling", daysAgo: 70  },
    { email: "carlos.martinez@kirbycorp.com", badgeName: "Assessment Ace",  reason: "Passed HazMat Knowledge Check on first attempt", daysAgo: 2   },
    { email: "jennifer.miller@kirbycorp.com", badgeName: "First Steps",     reason: "Completed first course: OSHA 30-Hour Maritime Safety", daysAgo: 55  },
    { email: "david.brown@kirbycorp.com",     badgeName: "First Steps",     reason: "Completed first course: Data Security & Cyber Awareness", daysAgo: 80 },
  ];

  for (const a of badgeAwards) {
    const userId = users[a.email]?.id;
    const badgeId = badges[a.badgeName]?.id;
    if (!userId || !badgeId) continue;
    await db.userBadge.upsert({
      where: { userId_badgeId: { userId, badgeId } },
      update: {},
      create: {
        userId,
        badgeId,
        awardedById: admin.id,
        reason: a.reason,
        awardedAt: subDays(now, a.daysAgo),
      },
    });
  }
  console.log(`✔  ${badgeDefs.length} badges seeded, ${badgeAwards.length} awarded`);

  // ── 18. Forum ─────────────────────────────────────────────────────────────
  const forumGeneral = await db.forumCategory.create({
    data: { tenantId: tenant.id, name: "General Discussion", description: "Company-wide announcements and general conversation.", sortOrder: 1, isActive: true },
  });
  const forumSafety = await db.forumCategory.create({
    data: { tenantId: tenant.id, name: "Maritime Safety Q&A", description: "Questions and answers about maritime safety procedures and regulations.", sortOrder: 2, isActive: true },
  });
  const forumOsha = await db.forumCategory.create({
    data: { tenantId: tenant.id, courseId: courses[0].id, name: "OSHA Course Discussion", description: "Discussion board for OSHA 30-Hour Maritime Safety course participants.", sortOrder: 3, isActive: true },
  });

  // Forum threads & posts
  const thread1 = await db.forumThread.create({
    data: {
      categoryId: forumSafety.id,
      authorId: users["john.smith@kirbycorp.com"].id,
      title: "Best practices for man overboard drills",
      isPinned: true,
      isLocked: false,
      viewCount: 47,
      postCount: 3,
      createdAt: subDays(now, 14),
    },
  });
  await db.forumPost.createMany({
    data: [
      { threadId: thread1.id, authorId: users["john.smith@kirbycorp.com"].id, body: "We recently updated our MOB drill schedule to quarterly instead of semi-annually. Has anyone found that more frequent drills significantly improve response times?", isEdited: false, createdAt: subDays(now, 14) },
      { threadId: thread1.id, authorId: users["thomas.williams@kirbycorp.com"].id, body: "We saw a 30% improvement in response times after moving to monthly drills. The key was making them unannounced. Crew stops treating them as routine when they don't know when to expect them.", isEdited: false, createdAt: subDays(now, 13) },
      { threadId: thread1.id, authorId: users["mike.wilson@kirbycorp.com"].id, body: "Agree with Thomas. We also added night-time drills which exposed a lot of gaps in our lighting and equipment readiness. Highly recommend.", isEdited: false, createdAt: subDays(now, 12) },
    ],
  });

  const thread2 = await db.forumThread.create({
    data: {
      categoryId: forumOsha.id,
      authorId: users["emily.chen@kirbycorp.com"].id,
      title: "Question about fall protection on vessel decks",
      isPinned: false,
      isLocked: false,
      viewCount: 23,
      postCount: 2,
      createdAt: subDays(now, 7),
    },
  });
  await db.forumPost.createMany({
    data: [
      { threadId: thread2.id, authorId: users["emily.chen@kirbycorp.com"].id, body: "The course mentions 4-foot threshold for fall protection but I've seen different requirements in our vessel-specific SOPs. Which takes precedence?", isEdited: false, createdAt: subDays(now, 7) },
      { threadId: thread2.id, authorId: users["mike.wilson@kirbycorp.com"].id, body: "Great question Emily. The vessel-specific SOP always takes precedence if it's more stringent than OSHA minimums. Our vessel SOPs typically require fall protection at any height over water. Always follow the more protective standard.", isEdited: false, createdAt: subDays(now, 6) },
    ],
  });

  const thread3 = await db.forumThread.create({
    data: {
      categoryId: forumGeneral.id,
      authorId: admin.id,
      title: "Q2 2026 Training Completion Reminder",
      isPinned: true,
      isLocked: false,
      viewCount: 89,
      postCount: 1,
      createdAt: subDays(now, 7),
    },
  });
  await db.forumPost.create({
    data: { threadId: thread3.id, authorId: admin.id, body: "All personnel must complete their Q2 2026 required training by June 30, 2026. Please log in to the LMS and check your 'My Courses' dashboard for outstanding requirements. Contact HR with questions.", isEdited: false, createdAt: subDays(now, 7) },
  });
  console.log(`✔  3 forum categories, 3 threads seeded`);

  // ── 19. Course Ratings ────────────────────────────────────────────────────
  const ratingDefs = [
    { email: "emily.chen@kirbycorp.com",      courseTitle: "OSHA 30-Hour Maritime Safety",   rating: 5, comment: "Excellent course. Very thorough coverage of maritime-specific OSHA requirements. The section on vessel deck safety was particularly relevant to my daily work." },
    { email: "emily.chen@kirbycorp.com",      courseTitle: "USCG Basic Safety Training",      rating: 4, comment: "Well structured content. The interactive scenarios helped reinforce the material. Would benefit from more video demonstrations." },
    { email: "emily.chen@kirbycorp.com",      courseTitle: "Data Security & Cyber Awareness", rating: 5, comment: "Engaging and surprisingly relevant for maritime operations. The section on OT/IT security was eye-opening." },
    { email: "thomas.williams@kirbycorp.com", courseTitle: "OSHA 30-Hour Maritime Safety",   rating: 5, comment: "As a safety inspector, I found this course well-aligned with current OSHA maritime standards. Good refresher material even for experienced personnel." },
    { email: "thomas.williams@kirbycorp.com", courseTitle: "Environmental Compliance for Marine Operations", rating: 4, comment: "Solid overview of EPA requirements. Would appreciate more detail on ballast water management procedures specific to our vessel types." },
    { email: "jennifer.miller@kirbycorp.com", courseTitle: "OSHA 30-Hour Maritime Safety",   rating: 4, comment: "Good content but some engineering-specific scenarios would be helpful. Still very useful for understanding the regulatory framework." },
    { email: "jennifer.miller@kirbycorp.com", courseTitle: "Emergency Response Procedures",   rating: 5, comment: "Exactly what I needed. The step-by-step emergency procedures are clear and the scenarios felt realistic." },
    { email: "carlos.martinez@kirbycorp.com", courseTitle: "Hazardous Materials Handling",    rating: 4, comment: "Very practical. The SDS interpretation exercises were helpful. Glad this is required for our department." },
    { email: "david.brown@kirbycorp.com",     courseTitle: "Data Security & Cyber Awareness", rating: 5, comment: "As an IT professional I appreciated the maritime-specific angle on cybersecurity. Well produced and up-to-date content." },
  ];

  for (const r of ratingDefs) {
    const userId = users[r.email]?.id;
    const courseId = courseMap[r.courseTitle];
    if (!userId || !courseId) continue;
    await db.courseRating.upsert({
      where: { courseId_userId: { courseId, userId } },
      update: {},
      create: { courseId, userId, rating: r.rating, comment: r.comment },
    });
  }
  console.log(`✔  ${ratingDefs.length} course ratings seeded`);

  // ── 20. Digital Certificates ──────────────────────────────────────────────
  const digitalCertDefs = [
    { email: "emily.chen@kirbycorp.com",      courseTitle: "OSHA 30-Hour Maritime Safety",   issuedDaysAgo: 45, validForDays: 1095 },
    { email: "emily.chen@kirbycorp.com",      courseTitle: "USCG Basic Safety Training",      issuedDaysAgo: 30, validForDays: 1825 },
    { email: "emily.chen@kirbycorp.com",      courseTitle: "Data Security & Cyber Awareness", issuedDaysAgo: 60, validForDays: 365 },
    { email: "thomas.williams@kirbycorp.com", courseTitle: "OSHA 30-Hour Maritime Safety",   issuedDaysAgo: 120, validForDays: 1095 },
    { email: "jennifer.miller@kirbycorp.com", courseTitle: "Emergency Response Procedures",   issuedDaysAgo: 40,  validForDays: 365 },
    { email: "carlos.martinez@kirbycorp.com", courseTitle: "Hazardous Materials Handling",    issuedDaysAgo: 70,  validForDays: 730 },
    { email: "david.brown@kirbycorp.com",     courseTitle: "Data Security & Cyber Awareness", issuedDaysAgo: 80,  validForDays: 365 },
  ];

  for (const d of digitalCertDefs) {
    const userId = users[d.email]?.id;
    const user = Object.values(users).find((u) => u.id === userId);
    const courseId = courseMap[d.courseTitle];
    if (!userId || !courseId || !user) continue;
    const issuedAt = subDays(now, d.issuedDaysAgo);
    await db.digitalCertificate.create({
      data: {
        tenantId: tenant.id,
        userId,
        title: d.courseTitle,
        issuerName: "Kirby Learning Academy",
        recipientName: user.name ?? "",
        issuedAt,
        expiresAt: addDays(issuedAt, d.validForDays),
      },
    });
  }
  console.log(`✔  ${digitalCertDefs.length} digital certificates seeded`);

  console.log("\n✅  Seed complete.");
  console.log("   Demo login credentials:");
  console.log("   Admin:             admin@kirbycorp.com    / KLA.adm1n");
  console.log("   Manager:           john.smith@kirbycorp.com / KLA.demo1");
  console.log("   Compliance Officer: sarah.jones@kirbycorp.com / KLA.demo1");
  console.log("   Instructor:        mike.wilson@kirbycorp.com / KLA.demo1");
  console.log("   Employee:          emily.chen@kirbycorp.com  / KLA.demo1");
  console.log("   Contractor:        robert.johnson@kirbycorp.com / KLA.demo1");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
