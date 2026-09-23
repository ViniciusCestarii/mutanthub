CREATE EXTENSION IF NOT EXISTS citext;

-- Placeholders (no githubId) may duplicate another account whose username
-- differs only in case. Merge each one into the account that keeps the name:
-- the real (GitHub-linked) account if any, else the oldest placeholder.
-- Two real accounts sharing a name are left alone and make the ALTER fail.
CREATE TEMP TABLE "_UsernameMerge" AS
SELECT id AS "fromId", "keepId" AS "toId"
FROM (
  SELECT id, "githubId",
         first_value(id) OVER (
           PARTITION BY lower("githubUsername")
           ORDER BY "githubId" IS NULL, "createdAt", id
         ) AS "keepId"
  FROM "User"
) u
WHERE id <> "keepId" AND "githubId" IS NULL;

-- Keep the highest role per project.
INSERT INTO "ProjectMember" (id, "projectId", "userId", role, "createdAt")
SELECT gen_random_uuid()::text, pm."projectId", m."toId", max(pm.role), min(pm."createdAt")
FROM "ProjectMember" pm
JOIN "_UsernameMerge" m ON m."fromId" = pm."userId"
GROUP BY pm."projectId", m."toId"
ON CONFLICT ("projectId", "userId")
DO UPDATE SET role = GREATEST("ProjectMember".role, EXCLUDED.role);

INSERT INTO "ProjectFollow" ("projectId", "userId", "createdAt")
SELECT f."projectId", m."toId", min(f."createdAt")
FROM "ProjectFollow" f
JOIN "_UsernameMerge" m ON m."fromId" = f."userId"
GROUP BY f."projectId", m."toId"
ON CONFLICT DO NOTHING;

UPDATE "User" u
SET "globalRole" = 'ADMIN'
FROM "_UsernameMerge" m
JOIN "User" f ON f.id = m."fromId"
WHERE u.id = m."toId" AND f."globalRole" = 'ADMIN';

-- Reassign everything else the placeholders own or reference.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('Project', 'addedById'),
    ('Mutant', 'createdById'),
    ('Submission', 'submittedById'),
    ('Validation', 'userId'),
    ('Comment', 'userId'),
    ('MutantStatusHistory', 'changedById'),
    ('Activity', 'actorId'),
    ('Notification', 'userId'),
    ('Notification', 'actorId'),
    ('AuditLog', 'actorId'),
    ('DatasetSnapshot', 'createdById'),
    ('KillClaim', 'claimedById'),
    ('KillClaim', 'resolvedById'),
    ('ImportBatch', 'importedById')
  ) AS t(tbl, col) LOOP
    EXECUTE format(
      'UPDATE %I t SET %I = m."toId" FROM "_UsernameMerge" m WHERE t.%I = m."fromId"',
      r.tbl, r.col, r.col
    );
  END LOOP;
END $$;

UPDATE "AuditLog" a
SET "targetId" = m."toId"
FROM "_UsernameMerge" m
WHERE a."targetType" = 'member' AND a."targetId" = m."fromId";

-- Only the merged memberships and follows are left to cascade.
DELETE FROM "User" u USING "_UsernameMerge" m WHERE u.id = m."fromId";

DROP TABLE "_UsernameMerge";

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "githubUsername" SET DATA TYPE CITEXT;
