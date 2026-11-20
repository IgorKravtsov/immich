import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql`CREATE OR REPLACE FUNCTION partner_locked_asset_delete_audit()
  RETURNS TRIGGER
  LANGUAGE PLPGSQL
  AS $$
    BEGIN
      INSERT INTO partner_locked_asset_audit ("sharedById", "sharedWithId", "assetId")
      SELECT "sharedById", "sharedWithId", "assetId"
      FROM OLD;
      RETURN NULL;
    END
  $$;`.execute(db);
  await sql`ALTER TABLE "album" ADD "isLocked" boolean NOT NULL DEFAULT false;`.execute(db);
  await sql`CREATE TABLE "partner_locked_asset_audit" (
  "id" uuid NOT NULL DEFAULT immich_uuid_v7(),
  "sharedById" uuid NOT NULL,
  "sharedWithId" uuid NOT NULL,
  "assetId" uuid NOT NULL,
  "deletedAt" timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT "partner_locked_asset_audit_pkey" PRIMARY KEY ("id")
);`.execute(db);
  await sql`CREATE INDEX "partner_locked_asset_audit_sharedById_idx" ON "partner_locked_asset_audit" ("sharedById");`.execute(db);
  await sql`CREATE INDEX "partner_locked_asset_audit_sharedWithId_idx" ON "partner_locked_asset_audit" ("sharedWithId");`.execute(db);
  await sql`CREATE INDEX "partner_locked_asset_audit_assetId_idx" ON "partner_locked_asset_audit" ("assetId");`.execute(db);
  await sql`CREATE INDEX "partner_locked_asset_audit_deletedAt_idx" ON "partner_locked_asset_audit" ("deletedAt");`.execute(db);
  await sql`CREATE TABLE "partner_locked_asset" (
  "sharedById" uuid NOT NULL,
  "sharedWithId" uuid NOT NULL,
  "assetId" uuid NOT NULL,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "createId" uuid NOT NULL DEFAULT immich_uuid_v7(),
  "updatedAt" timestamp with time zone NOT NULL DEFAULT now(),
  "updateId" uuid NOT NULL DEFAULT immich_uuid_v7(),
  CONSTRAINT "partner_locked_asset_sharedById_fkey" FOREIGN KEY ("sharedById") REFERENCES "user" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "partner_locked_asset_sharedWithId_fkey" FOREIGN KEY ("sharedWithId") REFERENCES "user" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "partner_locked_asset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "partner_locked_asset_pkey" PRIMARY KEY ("sharedById", "sharedWithId", "assetId")
);`.execute(db);
  await sql`CREATE INDEX "partner_locked_asset_sharedWithId_idx" ON "partner_locked_asset" ("sharedWithId");`.execute(db);
  await sql`CREATE INDEX "partner_locked_asset_assetId_idx" ON "partner_locked_asset" ("assetId");`.execute(db);
  await sql`CREATE INDEX "partner_locked_asset_createId_idx" ON "partner_locked_asset" ("createId");`.execute(db);
  await sql`CREATE INDEX "partner_locked_asset_updateId_idx" ON "partner_locked_asset" ("updateId");`.execute(db);
  await sql`CREATE OR REPLACE TRIGGER "partner_locked_asset_delete_audit"
  AFTER DELETE ON "partner_locked_asset"
  REFERENCING OLD TABLE AS "old"
  FOR EACH STATEMENT
  WHEN (pg_trigger_depth() <= 1)
  EXECUTE FUNCTION partner_locked_asset_delete_audit();`.execute(db);
  await sql`CREATE OR REPLACE TRIGGER "partner_locked_asset_updatedAt"
  BEFORE UPDATE ON "partner_locked_asset"
  FOR EACH ROW
  EXECUTE FUNCTION updated_at();`.execute(db);
  await sql`INSERT INTO "migration_overrides" ("name", "value") VALUES ('function_partner_locked_asset_delete_audit', '{"type":"function","name":"partner_locked_asset_delete_audit","sql":"CREATE OR REPLACE FUNCTION partner_locked_asset_delete_audit()\\n  RETURNS TRIGGER\\n  LANGUAGE PLPGSQL\\n  AS $$\\n    BEGIN\\n      INSERT INTO partner_locked_asset_audit (\\"sharedById\\", \\"sharedWithId\\", \\"assetId\\")\\n      SELECT \\"sharedById\\", \\"sharedWithId\\", \\"assetId\\"\\n      FROM OLD;\\n      RETURN NULL;\\n    END\\n  $$;"}'::jsonb);`.execute(db);
  await sql`INSERT INTO "migration_overrides" ("name", "value") VALUES ('trigger_partner_locked_asset_delete_audit', '{"type":"trigger","name":"partner_locked_asset_delete_audit","sql":"CREATE OR REPLACE TRIGGER \\"partner_locked_asset_delete_audit\\"\\n  AFTER DELETE ON \\"partner_locked_asset\\"\\n  REFERENCING OLD TABLE AS \\"old\\"\\n  FOR EACH STATEMENT\\n  WHEN (pg_trigger_depth() <= 1)\\n  EXECUTE FUNCTION partner_locked_asset_delete_audit();"}'::jsonb);`.execute(db);
  await sql`INSERT INTO "migration_overrides" ("name", "value") VALUES ('trigger_partner_locked_asset_updatedAt', '{"type":"trigger","name":"partner_locked_asset_updatedAt","sql":"CREATE OR REPLACE TRIGGER \\"partner_locked_asset_updatedAt\\"\\n  BEFORE UPDATE ON \\"partner_locked_asset\\"\\n  FOR EACH ROW\\n  EXECUTE FUNCTION updated_at();"}'::jsonb);`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TRIGGER "partner_locked_asset_delete_audit" ON "partner_locked_asset";`.execute(db);
  await sql`ALTER TABLE "album" DROP COLUMN "isLocked";`.execute(db);
  await sql`DROP TRIGGER "partner_locked_asset_updatedAt" ON "partner_locked_asset";`.execute(db);
  await sql`DROP TABLE "partner_locked_asset_audit";`.execute(db);
  await sql`DROP TABLE "partner_locked_asset";`.execute(db);
  await sql`DROP FUNCTION partner_locked_asset_delete_audit;`.execute(db);
  await sql`DELETE FROM "migration_overrides" WHERE "name" = 'function_partner_locked_asset_delete_audit';`.execute(db);
  await sql`DELETE FROM "migration_overrides" WHERE "name" = 'trigger_partner_locked_asset_delete_audit';`.execute(db);
  await sql`DELETE FROM "migration_overrides" WHERE "name" = 'trigger_partner_locked_asset_updatedAt';`.execute(db);
}
