import { authManager } from '#lib/managers/auth-manager.svelte.ts';
import AlbumOptionsModal from '#lib/modals/AlbumOptionsModal.svelte';
import { factory } from '#test/unit/factories.ts';
import { test } from '#test/unit/fixtures.ts';
import { AlbumUserRole, PartnerDirection } from '@immich/sdk';
import { expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

const bobCheckbox = page.getByRole('checkbox', { name: 'Bob', exact: true });

test('shares a locked album with a partner as a viewer and stops sharing', async ({ data, settle, api }) => {
  authManager.setUser(data.user);
  const bob = factory.partner({ name: 'Bob' });
  data.addPartners(PartnerDirection.SharedBy, bob);
  const album = factory.album({ albumUsers: factory.albumUsers({ owner: data.user }), isLocked: true });
  data.addAlbums(album);

  await render(AlbumOptionsModal, { album, onClose: vi.fn() });
  await settle();
  await expect.element(page.getByText('locked_album_sharing_notice', { exact: true })).toBeVisible();

  await bobCheckbox.click();
  await settle();

  expect(api.addUsersToAlbum).toHaveBeenCalledWith({
    params: { id: album.id },
    body: { albumUsers: [{ userId: bob.id, role: AlbumUserRole.Viewer }] },
  });
  await expect.element(bobCheckbox).toBeChecked();

  await bobCheckbox.click();
  await settle();

  expect(api.removeUserFromAlbum).toHaveBeenCalledWith({ params: { id: album.id, userId: bob.id } });
});

test('does not offer partners for a regular album', async ({ data, settle }) => {
  authManager.setUser(data.user);
  data.addPartners(PartnerDirection.SharedBy, factory.partner({ name: 'Bob' }));
  const album = factory.album({ albumUsers: factory.albumUsers({ owner: data.user }) });
  data.addAlbums(album);

  await render(AlbumOptionsModal, { album, onClose: vi.fn() });
  await settle();

  await expect.element(page.getByText('locked_album_sharing_notice', { exact: true })).not.toBeInTheDocument();
  await expect.element(bobCheckbox).not.toBeInTheDocument();
});
