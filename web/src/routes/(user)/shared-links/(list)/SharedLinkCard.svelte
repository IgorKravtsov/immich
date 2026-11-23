<script lang="ts">
  import { queryClient } from '#lib/queries/client.ts';
  import { QueryKeys } from '#lib/queries/query-keys.ts';
  import { Route } from '#lib/route.ts';
  import { getSharedLinkActions } from '#lib/services/shared-link.service.ts';
  import { locale } from '#lib/stores/preferences.store.ts';
  import { requireElevatedSession } from '#lib/utils/elevated-session.ts';
  import { SharedLinkType, type SharedLinkResponseDto } from '@immich/sdk';
  import { ActionButton, ContextMenuButton, Icon, MenuItemType, Text } from '@immich/ui';
  import { mdiLockOpenVariantOutline } from '@mdi/js';
  import { DateTime, type ToRelativeUnit } from 'luxon';
  import { t } from 'svelte-i18n';
  import ShareCover from './ShareCover.svelte';

  interface Props {
    sharedLink: SharedLinkResponseDto;
    isElevated: boolean;
  }

  let { sharedLink, isElevated }: Props = $props();

  let isLocked = $derived(!!sharedLink.album?.isLocked && !isElevated);

  const handleUnlock = async () => {
    if (await requireElevatedSession()) {
      await queryClient.invalidateQueries({ queryKey: QueryKeys.sharedLinks() });
    }
  };

  let now = DateTime.now();
  let expiresAt = $derived(sharedLink.expiresAt ? DateTime.fromISO(sharedLink.expiresAt) : undefined);
  let isExpired = $derived(expiresAt && now > expiresAt);

  const getCountDownExpirationDate = (expiresAtDate: DateTime, now: DateTime) => {
    const relativeUnits: ToRelativeUnit[] = ['days', 'hours', 'minutes', 'seconds'];
    const expirationCountdown = expiresAtDate.diff(now, relativeUnits).toObject();

    for (const unit of relativeUnits) {
      const value = expirationCountdown[unit];
      if (value && value > 0) {
        return expiresAtDate.toRelativeCalendar({ base: now, locale: $locale, unit });
      }
    }
  };

  const { Edit, Copy, Delete } = $derived(getSharedLinkActions($t, sharedLink));

  const capabilities = $derived.by(() => {
    const items = [];

    if (sharedLink.allowUpload) {
      items.push($t('upload'));
    }

    if (sharedLink.allowDownload) {
      items.push($t('download'));
    }

    if (sharedLink.showMetadata) {
      items.push($t('exif'));
    }

    if (sharedLink.password) {
      items.push($t('password'));
    }

    return items;
  });
</script>

{#snippet content()}
  <ShareCover class="transition-all duration-300 hover:shadow-lg" {sharedLink} locked={isLocked} />

  <div class="flex flex-col justify-between gap-4">
    <div class="flex flex-col">
      <Text size="tiny" color={isExpired ? 'danger' : 'muted'} fontWeight="medium">
        {#if isExpired}
          {$t('expired')}
        {:else if expiresAt}
          {$t('expires_date', { values: { date: getCountDownExpirationDate(expiresAt, now) } })}
        {:else}
          {$t('expires_date', { values: { date: '∞' } })}
        {/if}
      </Text>

      <Text size="large" color="primary" class="flex place-items-center gap-2 break-all" fontWeight="medium">
        {#if sharedLink.type === SharedLinkType.Album}
          {sharedLink.album?.albumName}
        {:else if sharedLink.type === SharedLinkType.Individual}
          {$t('individual_share')}
        {/if}
      </Text>

      {#if sharedLink.description}
        <Text size="small" class="line-clamp-1">{sharedLink.description}</Text>
      {/if}
    </div>

    <div class="flex flex-wrap items-center gap-2">
      {#if isLocked}
        <span
          class="flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-sm font-medium text-light"
          data-testid="unlock-shared-link"
        >
          <Icon icon={mdiLockOpenVariantOutline} size="16" />
          {$t('unlock')}
        </span>
      {/if}
      {#each capabilities as capability, index (index)}
        <Text size="small" color="primary" fontWeight="medium">
          {capability}
        </Text>
        {#if index < capabilities.length - 1}
          <Text size="small" color="muted">•</Text>
        {/if}
      {/each}
    </div>
  </div>
{/snippet}

<div
  class="flex w-full border-b border-gray-200 transition-all hover:border-immich-primary dark:border-gray-600 dark:text-immich-gray dark:hover:border-immich-dark-primary"
>
  {#if isLocked}
    <button type="button" class="flex w-full gap-4 py-4 text-start" onclick={handleUnlock}>
      {@render content()}
    </button>
  {:else}
    <svelte:element
      this={isExpired ? 'div' : 'a'}
      href={isExpired ? undefined : Route.viewSharedLink(sharedLink)}
      class="flex w-full gap-4 py-4"
    >
      {@render content()}
    </svelte:element>
  {/if}
  <div class="ms-4 flex flex-auto flex-col place-content-center place-items-end text-end">
    <div class="hidden sm:flex">
      <ActionButton action={Edit} />
      <ActionButton action={Copy} />
      <ActionButton action={Delete} />
    </div>

    <div class="sm:hidden">
      <ContextMenuButton
        aria-label={$t('shared_link_options')}
        position="top-right"
        items={[Edit, Copy, MenuItemType.Divider, Delete]}
      />
    </div>
  </div>
</div>
