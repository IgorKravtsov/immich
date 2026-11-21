import PinCodeUnlockModal from '#lib/modals/PinCodeUnlockModal.svelte';
import { getAuthStatusQuery } from '#lib/queries/auth.query.ts';
import { queryClient } from '#lib/queries/client.ts';
import { Route } from '#lib/route.ts';
import { modalManager } from '@immich/ui';
import { goto } from '$app/navigation';
import { page } from '$app/state';

export const requireElevatedSession = async () => {
  const { isElevated, pinCode } = await queryClient.fetchQuery(getAuthStatusQuery());
  if (isElevated && pinCode) {
    return true;
  }

  if (!pinCode) {
    await goto(Route.pinPrompt({ continue: page.url.pathname + page.url.search }));
    return false;
  }

  return !!(await modalManager.show(PinCodeUnlockModal, {}));
};
