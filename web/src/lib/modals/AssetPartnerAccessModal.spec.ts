import AssetPartnerAccessModal from '#lib/modals/AssetPartnerAccessModal.svelte';
import { factory } from '#test/unit/factories.ts';
import { test } from '#test/unit/fixtures.ts';
import { PartnerDirection } from '@immich/sdk';
import { expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

const checkbox = (name: string) => page.getByRole('checkbox', { name, exact: true });

test('shows locked photos to a partner and hides them again', async ({ data, settle, api }) => {
  const bob = factory.partner({ name: 'Bob' });
  data.addPartners(PartnerDirection.SharedBy, bob);
  const assetIds = [crypto.randomUUID(), crypto.randomUUID()];

  await render(AssetPartnerAccessModal, { assetIds, onClose: vi.fn() });
  await settle();
  await expect.element(checkbox('Bob')).not.toBeChecked();

  await checkbox('Bob').click();
  await settle();

  expect(api.addPartnerLockedAssets).toHaveBeenCalledWith({ params: { id: bob.id }, body: { assetIds } });
  await expect.element(checkbox('Bob')).toBeChecked();

  await checkbox('Bob').click();
  await settle();

  expect(api.removePartnerLockedAssets).toHaveBeenCalledWith({ params: { id: bob.id }, body: { assetIds } });
  await expect.element(checkbox('Bob')).not.toBeChecked();
});

test('marks partners who already see the photos', async ({ data, settle }) => {
  const [bob, carol] = [factory.partner({ name: 'Bob' }), factory.partner({ name: 'Carol' })];
  data.addPartners(PartnerDirection.SharedBy, [bob, carol]);
  const assetId = crypto.randomUUID();
  data.addPartnerLockedAssets(bob.id, [assetId]);

  await render(AssetPartnerAccessModal, { assetIds: [assetId], onClose: vi.fn() });
  await settle();

  await expect.element(checkbox('Bob')).toBeChecked();
  await expect.element(checkbox('Carol')).not.toBeChecked();
});

test('explains when there are no partners', async ({ settle }) => {
  await render(AssetPartnerAccessModal, { assetIds: [crypto.randomUUID()], onClose: vi.fn() });
  await settle();

  await expect.element(page.getByText('no_partners_to_share_with', { exact: true })).toBeVisible();
});
