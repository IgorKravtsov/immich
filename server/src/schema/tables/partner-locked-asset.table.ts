import {
  AfterDeleteTrigger,
  CreateDateColumn,
  ForeignKeyColumn,
  Table,
  Timestamp,
  UpdateDateColumn,
  type Generated,
} from '@immich/sql-tools';
import { CreateIdColumn, UpdateIdColumn, UpdatedAtTrigger } from 'src/decorators.js';
import { partner_locked_asset_delete_audit } from 'src/schema/functions.js';
import { AssetTable } from 'src/schema/tables/asset.table.js';
import { UserTable } from 'src/schema/tables/user.table.js';

@Table('partner_locked_asset')
@UpdatedAtTrigger('partner_locked_asset_updatedAt')
@AfterDeleteTrigger({
  scope: 'statement',
  function: partner_locked_asset_delete_audit,
  referencingOldTableAs: 'old',
  when: 'pg_trigger_depth() <= 1',
})
export class PartnerLockedAssetTable {
  @ForeignKeyColumn(() => UserTable, { onDelete: 'CASCADE', primary: true, index: false })
  sharedById!: string;

  @ForeignKeyColumn(() => UserTable, { onDelete: 'CASCADE', primary: true })
  sharedWithId!: string;

  @ForeignKeyColumn(() => AssetTable, { onDelete: 'CASCADE', onUpdate: 'CASCADE', primary: true })
  assetId!: string;

  @CreateDateColumn()
  createdAt!: Generated<Timestamp>;

  @CreateIdColumn({ index: true })
  createId!: Generated<string>;

  @UpdateDateColumn()
  updatedAt!: Generated<Timestamp>;

  @UpdateIdColumn({ index: true })
  updateId!: Generated<string>;
}
