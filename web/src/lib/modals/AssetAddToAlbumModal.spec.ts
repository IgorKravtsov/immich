import AssetAddToAlbumModal from '#lib/modals/AssetAddToAlbumModal.svelte';
import { factory } from '#test/unit/factories.ts';
import { test } from '#test/unit/fixtures.ts';
import { expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

const albumButton = (name: string) => page.getByRole('dialog').getByRole('button').filter({ hasText: name }).first();

test('hides locked albums when the session is not elevated', async ({ data, settle }) => {
  data.setAuthStatus({ pinCode: true, isElevated: false });
  data.addAlbums([factory.album({ albumName: 'Holiday' }), factory.album({ albumName: 'Secret', isLocked: true })]);

  await render(AssetAddToAlbumModal, { assetIds: [crypto.randomUUID()], onClose: vi.fn() });
  await settle();

  await expect.element(albumButton('Holiday')).toBeVisible();
  await expect.element(albumButton('Secret')).not.toBeInTheDocument();
});

test('warns before adding regular photos to a locked album', async ({ data, settle, api, app }) => {
  data.setAuthStatus({ pinCode: true, isElevated: true });
  const album = factory.album({ albumName: 'Secret', isLocked: true });
  data.addAlbums([factory.album({ albumName: 'Holiday' }), album]);
  const assetIds = [crypto.randomUUID()];
  const onClose = vi.fn();

  await render(AssetAddToAlbumModal, { assetIds, onClose });
  await settle();
  await expect.element(albumButton('Secret').getByLabelText('locked_album')).toBeVisible();

  await albumButton('Secret').click();
  await expect.element(page.getByText('add_to_locked_album_confirmation', { exact: true })).toBeVisible();
  await app.dialogButton('add').click();
  await settle();

  expect(api.addAssetsToAlbum).toHaveBeenCalledWith({ params: { id: album.id }, body: { ids: assetIds } });
  expect(onClose).toHaveBeenCalled();
});

test('offers only locked albums for locked photos', async ({ data, settle, api }) => {
  data.setAuthStatus({ pinCode: true, isElevated: true });
  const album = factory.album({ albumName: 'Secret', isLocked: true });
  data.addAlbums([factory.album({ albumName: 'Holiday' }), album]);
  const assetIds = [crypto.randomUUID()];

  await render(AssetAddToAlbumModal, { assetIds, isLocked: true, onClose: vi.fn() });
  await settle();

  await expect.element(albumButton('Holiday')).not.toBeInTheDocument();
  await albumButton('Secret').click();
  await settle();

  expect(api.addAssetsToAlbum).toHaveBeenCalledWith({ params: { id: album.id }, body: { ids: assetIds } });
});
