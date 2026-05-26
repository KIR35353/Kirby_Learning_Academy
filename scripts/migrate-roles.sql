-- Step 1: Rename EMPLOYEE → STUDENT
UPDATE roles SET name = 'STUDENT', description = 'Enroll in and complete courses' WHERE name = 'EMPLOYEE';

-- Step 2: Reassign any COMPLIANCE_OFFICER / CONTRACTOR user_roles to STUDENT
INSERT INTO user_roles (id, "userId", "roleId", "createdAt")
  SELECT gen_random_uuid(), ur."userId", (SELECT id FROM roles WHERE name = 'STUDENT'), NOW()
  FROM user_roles ur
  WHERE ur."roleId" IN (SELECT id FROM roles WHERE name IN ('COMPLIANCE_OFFICER', 'CONTRACTOR'))
ON CONFLICT ("userId", "roleId") DO NOTHING;

-- Step 3: Delete stale user_roles rows
DELETE FROM user_roles WHERE "roleId" IN (SELECT id FROM roles WHERE name IN ('COMPLIANCE_OFFICER', 'CONTRACTOR'));

-- Step 4: Delete the old roles
DELETE FROM roles WHERE name IN ('COMPLIANCE_OFFICER', 'CONTRACTOR');
