import { authManager } from '#lib/managers/auth-manager.svelte.ts';
import { getAssetActions } from '#lib/services/asset.service.ts';
import { factory } from '#test/unit/factories.ts';
import { test } from '#test/unit/fixtures.ts';
import { AssetTypeEnum, AssetVisibility } from '@immich/sdk';
import { expect } from 'vitest';

const $t = ((key: string) => key) as never;

const editingActions = [
  'Tag',
  'TagPeople',
  'RefreshFacesJob',
  'RefreshMetadataJob',
  'RegenerateThumbnailJob',
  'TranscodeVideoJob',
] as const;

test('hides editing actions for a partner-owned locked asset', async ({ data }) => {
  data.setPreferences(factory.preferences({ tags: { enabled: true, sidebarWeb: false } }));
  await authManager.load();
  const asset = factory.asset({
    ownerId: 'partner-id',
    type: AssetTypeEnum.Video,
    visibility: AssetVisibility.Locked,
  });

  const actions = getAssetActions($t, asset);

  for (const name of editingActions) {
    expect(actions[name].$if?.(), name).toBe(false);
  }
});

test('shows editing actions for an owned locked asset', async ({ data }) => {
  data.setPreferences(factory.preferences({ tags: { enabled: true, sidebarWeb: false } }));
  await authManager.load();
  const asset = factory.asset({ ownerId: data.user.id, type: AssetTypeEnum.Image, visibility: AssetVisibility.Locked });

  const actions = getAssetActions($t, asset);

  for (const name of ['Tag', 'TagPeople', 'RefreshFacesJob', 'RefreshMetadataJob', 'RegenerateThumbnailJob'] as const) {
    expect(actions[name].$if?.(), name).toBe(true);
  }
});
