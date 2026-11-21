import { authManager } from '#lib/managers/auth-manager.svelte.ts';
import { Route } from '#lib/route.ts';
import { factory } from '#test/unit/factories.ts';
import { test } from '#test/unit/fixtures.ts';
import { AssetVisibility } from '@immich/sdk';
import { isRedirect } from '@sveltejs/kit';
import { expect } from 'vitest';
import { page } from 'vitest/browser';
import Page from './+page.svelte';
import { load } from './+page.ts';

const runLoad = async (url: string, albumId: string) => {
  await authManager.load();
  try {
    return await load({ url: new URL(url, location.origin), params: { albumId } } as never);
  } catch (error) {
    if (isRedirect(error)) {
      return { redirect: error.location };
    }
    throw error;
  }
};

test('prompts for the PIN code when the session is not elevated', async ({ data, api }) => {
  data.setAuthStatus({ pinCode: true, isElevated: false });
  const album = factory.album({ albumUsers: factory.albumUsers({ owner: data.user }), isLocked: true });
  data.addAlbums(album);
  const url = Route.viewAlbum(album);

  await expect(runLoad(url, album.id)).resolves.toEqual({ redirect: Route.pinPrompt({ continue: url }) });
  expect(api.getAlbumInfo).not.toHaveBeenCalled();
});

test('redirects a regular album to the albums page', async ({ data }) => {
  data.setAuthStatus({ pinCode: true, isElevated: true });
  const album = factory.album({ albumUsers: factory.albumUsers({ owner: data.user }) });
  data.addAlbums(album);

  await expect(runLoad(Route.viewAlbum({ id: album.id, isLocked: true }), album.id)).resolves.toEqual({
    redirect: Route.viewAlbum(album),
  });
});

test('shows a locked album with its locked photos', async ({ data, router, render, settle, api, app }) => {
  data.setAuthStatus({ pinCode: true, isElevated: true });
  const asset = factory.asset({ visibility: AssetVisibility.Locked });
  data.addAssets(asset);
  const album = factory.album({ albumUsers: factory.albumUsers({ owner: data.user }), isLocked: true });
  data.addAlbums(album).addToAlbum(album.id, asset);
  await router.goto(Route.viewAlbum(album), { albumId: album.id });

  await render(Page, load);
  await settle();

  await expect.element(app.album.lockedIndicator).toBeVisible();
  expect(api.getTimeBuckets).toHaveBeenCalledWith({
    params: expect.objectContaining({ albumId: album.id, visibility: AssetVisibility.Locked }),
  });
});

test('owner removes an album from the locked folder', async ({ data, router, render, settle, api, app }) => {
  data.setAuthStatus({ pinCode: true, isElevated: true });
  const album = factory.album({ albumUsers: factory.albumUsers({ owner: data.user }), isLocked: true });
  data.addAlbums(album);
  await router.goto(Route.viewAlbum(album), { albumId: album.id });
  await render(Page, load);
  await settle();

  await app.album.optionsMenuButton.click();
  await app.album.unlockMenuItem.click();
  await expect
    .element(page.getByRole('dialog').getByText('remove_album_from_locked_folder_confirmation'))
    .toBeVisible();
  await app.dialogButton('remove_from_locked_folder').click();
  await settle();

  expect(api.updateAlbumInfo).toHaveBeenCalledWith({ params: { id: album.id }, body: { isLocked: false } });
  expect(router.url.pathname).toBe(Route.viewAlbum({ id: album.id }));
});

test('closing a locked album returns to the locked albums', async ({ data, router, render, settle }) => {
  data.setAuthStatus({ pinCode: true, isElevated: true });
  const album = factory.album({ albumUsers: factory.albumUsers({ owner: data.user }), isLocked: true });
  data.addAlbums(album);
  await router.goto(Route.viewAlbum(album), { albumId: album.id });
  await render(Page, load);
  await settle();

  await page.getByTestId('control-bar').getByRole('button', { name: 'close' }).click();
  await settle();

  expect(router.url.pathname).toBe(Route.lockedAlbums());
});
