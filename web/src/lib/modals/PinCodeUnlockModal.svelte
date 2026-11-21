<script lang="ts">
  import { getAuthStatusQuery, unlockAuthSessionMutation } from '#lib/queries/auth.query.ts';
  import { executeMutation, queryClient } from '#lib/queries/client.ts';
  import { Icon, Modal, ModalBody, PinInput, Stack, Text } from '@immich/ui';
  import { mdiLockOutline } from '@mdi/js';
  import { t } from 'svelte-i18n';

  type Props = {
    onClose: (unlocked?: boolean) => void;
  };

  const { onClose }: Props = $props();

  let pinCode = $state('');
  let isBadPinCode = $state(false);

  const handleUnlock = (code: string) =>
    executeMutation(unlockAuthSessionMutation, [{ sessionUnlockDto: { pinCode: code } }], {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getAuthStatusQuery().queryKey });
        onClose(true);
      },
      onError: () => {
        isBadPinCode = true;
        pinCode = '';
      },
    });
</script>

<Modal title={$t('enter_your_pin_code')} size="small" onClose={() => onClose(false)}>
  <ModalBody>
    <Stack gap={4} class="items-center">
      <div class:text-danger={isBadPinCode} class:text-primary={!isBadPinCode}>
        <Icon icon={mdiLockOutline} size="48" />
      </div>
      <Text size="small" class="text-center">{$t('enter_your_pin_code_subtitle')}</Text>
      <PinInput password autofocus bind:value={pinCode} onComplete={handleUnlock} />
    </Stack>
  </ModalBody>
</Modal>
