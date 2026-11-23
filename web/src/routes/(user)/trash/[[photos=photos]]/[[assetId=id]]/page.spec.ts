import { authManager } from '#lib/managers/auth-manager.svelte.ts';
import { Route } from '#lib/route.ts';
import { test } from '#test/unit/fixtures.ts';
import { isRedirect } from '@sveltejs/kit';
import { expect } from 'vitest';
import { userEvent } from 'vitest/browser';
import Page from './+page.svelte';
import { load } from './+page.ts';

const runLoad = async (url: string) => {
  await authManager.load();
  try {
    return await load({ url: new URL(url, location.origin) } as never);
  } catch (error) {
    if (isRedirect(error)) {
      return { redirect: error.location };
    }
    throw error;
  }
};

test('prompts for the PIN code when the session is not elevated', async ({ data }) => {
  data.setAuthStatus({ pinCode: true, isElevated: false });

  await expect(runLoad(Route.trash())).resolves.toEqual({ redirect: Route.pinPrompt({ continue: Route.trash() }) });
});

test('prompts to set up a PIN code when none is set', async () => {
  await expect(runLoad(Route.trash())).resolves.toEqual({ redirect: Route.pinPrompt({ continue: Route.trash() }) });
});

test('hides empty trash and restore all while the trash is empty', async ({ data, router, render, settle, app }) => {
  data.setAuthStatus({ pinCode: true, isElevated: true });
  await router.goto(Route.trash());
  await render(Page, load);
  await settle();

  await expect.element(app.trash.emptyTrashButton).not.toBeInTheDocument();
  await expect.element(app.trash.restoreAllButton).not.toBeInTheDocument();
});

test('shows the actions once the trash has an asset', async ({ data, router, render, settle, app }) => {
  data.setAuthStatus({ pinCode: true, isElevated: true });
  const [asset] = data.addTimeline({ years: 1 });
  data.deleteAssets([asset.id]);
  await router.goto(Route.trash());
  await render(Page, load);
  await settle();

  await expect.element(app.trash.emptyTrashButton).toBeVisible();
  await expect.element(app.trash.restoreAllButton).toBeVisible();
});

test('empties the trash', async ({ data, router, render, settle, api, app }) => {
  data.setAuthStatus({ pinCode: true, isElevated: true });
  const [asset] = data.addTimeline({ years: 1 });
  data.deleteAssets([asset.id]);
  await router.goto(Route.trash());
  await render(Page, load);

  await app.trash.emptyTrashButton.click();
  await app.cancelButton.click();
  await settle();

  expect(api.emptyTrash).not.toHaveBeenCalled();

  await app.trash.emptyTrashButton.click();
  await app.confirmButton.click();
  await settle();

  expect(api.emptyTrash).toHaveBeenCalled();
  expect(api.restoreTrash).not.toHaveBeenCalled();
});

test('restores the whole trash', async ({ data, router, render, settle, api, app }) => {
  data.setAuthStatus({ pinCode: true, isElevated: true });
  const [asset] = data.addTimeline({ years: 1 });
  data.deleteAssets([asset.id]);
  await router.goto(Route.trash());
  await render(Page, load);

  await app.trash.restoreAllButton.click();
  await app.cancelButton.click();
  await settle();

  expect(api.restoreTrash).not.toHaveBeenCalled();

  await app.trash.restoreAllButton.click();
  await app.confirmButton.click();
  await settle();

  expect(api.restoreTrash).toHaveBeenCalled();
  expect(api.emptyTrash).not.toHaveBeenCalled();
});

test('restores the selected assets', async ({ data, router, render, settle, api, app }) => {
  data.setAuthStatus({ pinCode: true, isElevated: true });
  const [asset] = data.addTimeline({ years: 1 });
  data.deleteAssets([asset.id]);
  await router.goto(Route.trash());
  await render(Page, load);
  await expect.element(app.trash.restoreAllButton).toBeVisible();

  await app.gallery.selectAll();
  await app.trash.restoreSelectedButton.click();
  await settle();

  expect(api.restoreAssets).toHaveBeenCalledWith({ body: { ids: [asset.id] } });
  expect(api.restoreTrash).not.toHaveBeenCalled();
  await expect.element(app.trash.restoreAllButton).not.toBeInTheDocument();
});

test('finishes restoring when the selection ends mid-request', async ({ data, router, render, settle, api, app }) => {
  data.setAuthStatus({ pinCode: true, isElevated: true });
  const [asset] = data.addTimeline({ years: 1 });
  data.deleteAssets([asset.id]);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  api.on({
    restoreAssets: async ({ body }) => {
      await gate;
      return { json: { count: data.restoreAssets(body.ids) } };
    },
  });
  await router.goto(Route.trash());
  await render(Page, load);
  await expect.element(app.trash.restoreAllButton).toBeVisible();

  await app.gallery.selectAll();
  await app.trash.restoreSelectedButton.click();
  await userEvent.keyboard('{Escape}');
  release();
  await settle();

  expect(api.restoreAssets).toHaveBeenCalledWith({ body: { ids: [asset.id] } });
  await expect.element(app.trash.restoreAllButton).not.toBeInTheDocument();
});

test('locks the session and leaves the trash', async ({ data, router, render, settle, api, app }) => {
  data.setAuthStatus({ pinCode: true, isElevated: true });
  await router.goto(Route.trash());
  await render(Page, load);
  await settle();

  await app.auth.button('lock').click();
  await settle();

  expect(api.lockAuthSession).toHaveBeenCalled();
  expect(router.url.pathname).toBe(Route.photos());
});
