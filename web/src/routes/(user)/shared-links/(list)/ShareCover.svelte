<script lang="ts">
  import AlbumCover from '#lib/components/album-page/AlbumCover.svelte';
  import AssetCover from '#lib/components/sharedlinks-page/covers/AssetCover.svelte';
  import NoCover from '#lib/components/sharedlinks-page/covers/NoCover.svelte';
  import { getAssetMediaUrl } from '#lib/utils.ts';
  import type { SharedLinkResponseDto } from '@immich/sdk';
  import { Icon } from '@immich/ui';
  import { mdiLockOutline } from '@mdi/js';
  import { t } from 'svelte-i18n';

  interface Props {
    sharedLink: SharedLinkResponseDto;
    preload?: boolean;
    locked?: boolean;
    class?: string;
  }

  let { sharedLink, preload = false, locked = false, class: className = '' }: Props = $props();
</script>

<div class="relative size-22 shrink-0">
  {#if locked}
    <div
      class="flex size-full items-center justify-center rounded-xl bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300 {className}"
      data-testid="locked-cover"
    >
      <Icon icon={mdiLockOutline} size="40" aria-label={$t('locked_album')} />
    </div>
  {:else if sharedLink?.album}
    <AlbumCover album={sharedLink.album} class={className} {preload} />
  {:else if sharedLink.assets[0]}
    <AssetCover
      alt={$t('individual_share')}
      class={className}
      {preload}
      src={getAssetMediaUrl({ id: sharedLink.assets[0].id })}
    />
  {:else}
    <NoCover alt={$t('unnamed_share')} class={className} {preload} />
  {/if}
</div>
