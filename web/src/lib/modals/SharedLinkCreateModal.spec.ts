import SharedLinkCreateModal from '#lib/modals/SharedLinkCreateModal.svelte';
import { test } from '#test/unit/fixtures.ts';
import { expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

const createButton = page.getByRole('button', { name: 'create_link', exact: true });

test('requires a password for locked content', async () => {
  await render(SharedLinkCreateModal, { albumId: crypto.randomUUID(), requirePassword: true, onClose: vi.fn() });

  await expect.element(page.getByText('shared_link_password_required', { exact: true })).toBeVisible();
  await expect.element(createButton).toBeDisabled();

  await page.getByLabelText('password', { exact: true }).fill('secret');

  await expect.element(createButton).toBeEnabled();
});

test('does not require a password for regular content', async () => {
  await render(SharedLinkCreateModal, { albumId: crypto.randomUUID(), onClose: vi.fn() });

  await expect.element(page.getByText('shared_link_password_required', { exact: true })).not.toBeInTheDocument();
  await expect.element(createButton).toBeEnabled();
});
