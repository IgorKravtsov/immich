<script lang="ts">
  import AlbumPage from '#lib/components/album-page/AlbumPage.svelte';
  import type { PageProps } from './$types';

  let { params }: PageProps = $props();
</script>

<AlbumPage id={params.albumId} />
