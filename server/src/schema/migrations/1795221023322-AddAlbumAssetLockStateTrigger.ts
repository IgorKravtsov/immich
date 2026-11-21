import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql`CREATE OR REPLACE FUNCTION album_asset_enforce_lock_state()
  RETURNS TRIGGER
  LANGUAGE PLPGSQL
  AS $$
    DECLARE
      album_locked boolean;
      asset_visibility asset_visibility_enum;
    BEGIN
      SELECT "isLocked" INTO album_locked FROM album WHERE "id" = NEW."albumId" FOR SHARE;
      SELECT "visibility" INTO asset_visibility FROM asset WHERE "id" = NEW."assetId" FOR SHARE;
      IF asset_visibility IS NULL THEN
        RETURN NEW;
      END IF;
      IF COALESCE(album_locked, false) <> (asset_visibility = 'locked') THEN
        RETURN NULL;
      END IF;
      RETURN NEW;
    END
  $$;`.execute(db);
  await sql`CREATE OR REPLACE TRIGGER "album_asset_enforce_lock_state"
  BEFORE INSERT ON "album_asset"
  FOR EACH ROW
  EXECUTE FUNCTION album_asset_enforce_lock_state();`.execute(db);
  await sql`INSERT INTO "migration_overrides" ("name", "value") VALUES ('function_album_asset_enforce_lock_state', '{"type":"function","name":"album_asset_enforce_lock_state","sql":"CREATE OR REPLACE FUNCTION album_asset_enforce_lock_state()\\n  RETURNS TRIGGER\\n  LANGUAGE PLPGSQL\\n  AS $$\\n    DECLARE\\n      album_locked boolean;\\n      asset_visibility asset_visibility_enum;\\n    BEGIN\\n      SELECT \\"isLocked\\" INTO album_locked FROM album WHERE \\"id\\" = NEW.\\"albumId\\" FOR SHARE;\\n      SELECT \\"visibility\\" INTO asset_visibility FROM asset WHERE \\"id\\" = NEW.\\"assetId\\" FOR SHARE;\\n      IF asset_visibility IS NULL THEN\\n        RETURN NEW;\\n      END IF;\\n      IF COALESCE(album_locked, false) <> (asset_visibility = ''locked'') THEN\\n        RETURN NULL;\\n      END IF;\\n      RETURN NEW;\\n    END\\n  $$;"}'::jsonb);`.execute(db);
  await sql`INSERT INTO "migration_overrides" ("name", "value") VALUES ('trigger_album_asset_enforce_lock_state', '{"type":"trigger","name":"album_asset_enforce_lock_state","sql":"CREATE OR REPLACE TRIGGER \\"album_asset_enforce_lock_state\\"\\n  BEFORE INSERT ON \\"album_asset\\"\\n  FOR EACH ROW\\n  EXECUTE FUNCTION album_asset_enforce_lock_state();"}'::jsonb);`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TRIGGER "album_asset_enforce_lock_state" ON "album_asset";`.execute(db);
  await sql`DROP FUNCTION album_asset_enforce_lock_state;`.execute(db);
  await sql`DELETE FROM "migration_overrides" WHERE "name" = 'function_album_asset_enforce_lock_state';`.execute(db);
  await sql`DELETE FROM "migration_overrides" WHERE "name" = 'trigger_album_asset_enforce_lock_state';`.execute(db);
}
