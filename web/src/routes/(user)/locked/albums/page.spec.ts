import { authManager } from '#lib/managers/auth-manager.svelte.ts';
import { Route } from '#lib/route.ts';
import { factory } from '#test/unit/factories.ts';
import { test } from '#test/unit/fixtures.ts';
import { isRedirect } from '@sveltejs/kit';
import { expect } from 'vitest';
import Page from './+page.svelte';
import { load } from './+page.ts';

test('prompts for the PIN code when the session is not elevated', async ({ data, api }) => {
  data.setAuthStatus({ pinCode: true, isElevated: false });
  await authManager.load();

  const result = await load({ url: new URL(Route.lockedAlbums(), location.origin) } as never).catch((error: unknown) =>
    isRedirect(error) ? { redirect: error.location } : Promise.reject(error),
  );

  expect(result).toEqual({ redirect: Route.pinPrompt({ continue: Route.lockedAlbums() }) });
  expect(api.getAllAlbums).not.toHaveBeenCalled();
});

test('lists only locked albums with a lock indicator', async ({ data, router, render, settle, api, app }) => {
  data.setAuthStatus({ pinCode: true, isElevated: true });
  data.addAlbums([
    factory.album({ albumName: 'Secret', isLocked: true }),
    factory.album({ albumName: 'Holiday', isLocked: false }),
  ]);
  await router.goto(Route.lockedAlbums());

  await render(Page, load);
  await settle();

  expect(api.getAllAlbums).toHaveBeenCalledWith({ params: { isLocked: true } });
  await expect.element(app.albums.card('Secret').getByLabelText('locked_album')).toBeVisible();
  await expect.element(app.albums.card('Holiday')).not.toBeInTheDocument();
  await expect.element(app.lockedFolder.tab('albums')).toHaveAttribute('aria-current', 'page');
});

test('creates a locked album and opens it', async ({ data, router, render, settle, api, app }) => {
  data.setAuthStatus({ pinCode: true, isElevated: true });
  await router.goto(Route.lockedAlbums());
  await render(Page, load);
  await settle();

  await app.lockedFolder.createAlbumButton.click();
  await settle();

  expect(api.createAlbum).toHaveBeenCalledWith({ body: { albumName: '', isLocked: true } });
  expect(router.url.pathname).toMatch(/^\/locked\/albums\/[0-9a-f-]+$/);
});
