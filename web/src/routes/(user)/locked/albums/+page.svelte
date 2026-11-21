<script lang="ts">
  import OnEvents from '#lib/components/OnEvents.svelte';
  import AlbumCardGroup from '#lib/components/album-page/AlbumCardGroup.svelte';
  import UserPageLayout from '#lib/components/layouts/UserPageLayout.svelte';
  import LockedFolderTabs from '#lib/components/locked-folder/LockedFolderTabs.svelte';
  import EmptyPlaceholder from '#lib/components/shared-components/EmptyPlaceholder.svelte';
  import { getLockedAlbumsQuery } from '#lib/queries/album.query.ts';
  import { createPreloadedQuery } from '#lib/queries/client.ts';
  import { Route } from '#lib/route.ts';
  import { getLockedAlbumsActions } from '#lib/services/album.service.ts';
  import { getUserActions } from '#lib/services/user.service.ts';
  import { createAlbumAndRedirect } from '#lib/utils/album-utils.ts';
  import { t } from 'svelte-i18n';
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';

  type Props = {
    data: PageData;
  };

  const { data }: Props = $props();

  const query = createPreloadedQuery(getLockedAlbumsQuery);
  const albums = $derived(query.data);

  const { LockSession } = $derived(getUserActions($t));
  const { Create } = $derived(getLockedAlbumsActions($t));

  const onSessionLocked = async () => {
    await goto(Route.photos());
  };
</script>

<OnEvents {onSessionLocked} />

<UserPageLayout title={data.meta.title} actions={[Create, LockSession]}>
  {#snippet buttons()}
    <LockedFolderTabs active="albums" />
  {/snippet}

  {#if albums.length > 0}
    <AlbumCardGroup {albums} showOwner showItemCount />
  {:else}
    <EmptyPlaceholder
      title={$t('nothing_here_yet')}
      text={$t('no_locked_albums_message')}
      onClick={() => createAlbumAndRedirect({ isLocked: true })}
      class="mx-auto mt-10"
    />
  {/if}
</UserPageLayout>
