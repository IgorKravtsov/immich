import 'package:drift/drift.dart';
import 'package:immich_mobile/data/db/main/table/user/user.dart';
import 'package:immich_mobile/data/db/util/defaults_mixin.dart';

@TableIndex.sql(
  'CREATE INDEX IF NOT EXISTS idx_partner_locked_asset_shared_with_asset ON partner_locked_asset_entity (shared_with_id, asset_id)',
)
class PartnerLockedAssetEntity extends Table with DriftDefaultsMixin {
  const PartnerLockedAssetEntity();

  TextColumn get sharedById => text().references(UserEntity, #id, onDelete: KeyAction.cascade)();

  TextColumn get sharedWithId => text().references(UserEntity, #id, onDelete: KeyAction.cascade)();

  TextColumn get assetId => text()();

  @override
  Set<Column> get primaryKey => {sharedById, sharedWithId, assetId};
}
