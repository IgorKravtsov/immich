<script lang="ts">
  import UserAvatar from '#lib/components/shared-components/UserAvatar.svelte';
  import { executeMutation, queryClient } from '#lib/queries/client.ts';
  import {
    addPartnerLockedAssetsMutation,
    getPartnerLockedAssetsQuery,
    getPartnersQuery,
    removePartnerLockedAssetsMutation,
  } from '#lib/queries/partner.query.ts';
  import { PartnerDirection, type PartnerResponseDto } from '@immich/sdk';
  import { Checkbox, Label, LoadingSpinner, Modal, ModalBody, Stack, Text } from '@immich/ui';
  import { createQueries, createQuery } from '@tanstack/svelte-query';
  import { t } from 'svelte-i18n';

  type Props = {
    assetIds: string[];
    onClose: () => void;
  };

  const { assetIds, onClose }: Props = $props();

  const partnersQuery = createQuery(
    () => getPartnersQuery(PartnerDirection.SharedBy),
    () => queryClient,
  );
  const partners = $derived(partnersQuery.data ?? []);

  const accessQueries = createQueries(
    () => ({ queries: partners.map(({ id }) => getPartnerLockedAssetsQuery(id)) }),
    () => queryClient,
  );

  const getSharedCount = (index: number) => {
    const shared = new Set(accessQueries[index]?.data?.assetIds);
    return assetIds.filter((id) => shared.has(id)).length;
  };

  const handleToggle = async (partner: PartnerResponseDto, checked: boolean) => {
    const dto = { id: partner.id, partnerLockedAssetsDto: { assetIds } };
    await (checked
      ? executeMutation(addPartnerLockedAssetsMutation, [dto])
      : executeMutation(removePartnerLockedAssetsMutation, [dto]));
  };
</script>

<Modal title={$t('show_to_partners')} {onClose} size="small">
  <ModalBody>
    <Stack gap={4}>
      <Text size="small" color="muted">{$t('show_to_partners_description')}</Text>
      {#if partnersQuery.isPending}
        <div class="flex justify-center">
          <LoadingSpinner />
        </div>
      {:else if partners.length === 0}
        <Text size="small">{$t('no_partners_to_share_with')}</Text>
      {:else}
        {#each partners as partner, index (partner.id)}
          {const sharedCount = $derived(getSharedCount(index))}
          <div class="flex items-center gap-3">
            <Checkbox
              id="partner-access-{partner.id}"
              checked={sharedCount > 0 && sharedCount === assetIds.length}
              indeterminate={sharedCount > 0 && sharedCount < assetIds.length}
              disabled={!accessQueries[index]?.isSuccess}
              onCheckedChange={(checked) => handleToggle(partner, checked)}
            />
            <UserAvatar user={partner} size="sm" />
            <Label for="partner-access-{partner.id}" label={partner.name} />
          </div>
        {/each}
      {/if}
    </Stack>
  </ModalBody>
</Modal>
