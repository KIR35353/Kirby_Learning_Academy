-- Clean non-printable characters, BOM, and invisible Unicode from org name fields
-- Run: docker exec kla_postgres psql -U kla -d kla_dev -f /tmp/clean-org-names.sql

UPDATE departments
SET name = TRIM(
  REGEXP_REPLACE(
    REGEXP_REPLACE(name, '[\x01-\x1f\x7f]', '', 'g'),
    U&'\00AD\FEFF\200B\200C\200D\2060\FFFE', '', 'g'
  )
)
WHERE name ~ '[\x01-\x1f\x7f]'
   OR name != TRIM(name)
   OR name LIKE U&'%\00AD%'
   OR name LIKE U&'%\FEFF%'
   OR name LIKE U&'%\200B%';

UPDATE locations
SET name = TRIM(
  REGEXP_REPLACE(
    REGEXP_REPLACE(name, '[\x01-\x1f\x7f]', '', 'g'),
    U&'\00AD\FEFF\200B\200C\200D\2060\FFFE', '', 'g'
  )
)
WHERE name ~ '[\x01-\x1f\x7f]'
   OR name != TRIM(name)
   OR name LIKE U&'%\00AD%'
   OR name LIKE U&'%\FEFF%'
   OR name LIKE U&'%\200B%';

UPDATE job_titles
SET name = TRIM(
  REGEXP_REPLACE(
    REGEXP_REPLACE(name, '[\x01-\x1f\x7f]', '', 'g'),
    U&'\00AD\FEFF\200B\200C\200D\2060\FFFE', '', 'g'
  )
)
WHERE name ~ '[\x01-\x1f\x7f]'
   OR name != TRIM(name)
   OR name LIKE U&'%\00AD%'
   OR name LIKE U&'%\FEFF%'
   OR name LIKE U&'%\200B%';

-- Show results
SELECT 'departments' AS tbl, COUNT(*) FROM departments
UNION ALL
SELECT 'locations', COUNT(*) FROM locations
UNION ALL
SELECT 'job_titles', COUNT(*) FROM job_titles;
