<script lang="ts">
  import { Route } from '#lib/route.ts';
  import { t } from 'svelte-i18n';

  type Props = {
    active: 'photos' | 'albums';
  };

  const { active }: Props = $props();

  const tabs = $derived([
    { id: 'photos', label: $t('photos'), href: Route.locked() },
    { id: 'albums', label: $t('albums'), href: Route.lockedAlbums() },
  ]);
</script>

<nav aria-label={$t('locked_folder')} class="flex h-10 rounded-2xl bg-gray-200 dark:bg-immich-dark-gray">
  {#each tabs as tab (tab.id)}
    <a
      href={tab.href}
      aria-current={tab.id === active ? 'page' : undefined}
      class="flex h-full items-center px-4 text-sm first:rounded-s-2xl last:rounded-e-2xl hover:bg-gray-300 aria-[current=page]:bg-gray-300 dark:hover:bg-gray-800 dark:aria-[current=page]:bg-gray-700"
    >
      {tab.label}
    </a>
  {/each}
</nav>
