<script lang="ts">
  import AlbumPickerModal from '#lib/modals/AlbumPickerModal.svelte';
  import { addAssetsToAlbumsMutation } from '#lib/queries/album.query.ts';
  import { executeMutation } from '#lib/queries/client.ts';
  import { type AlbumResponseDto } from '@immich/sdk';
  import { t } from 'svelte-i18n';

  type Props = {
    assetIds: string[];
    isLocked?: boolean;
    onClose: () => void;
  };

  const { assetIds, isLocked = false, onClose }: Props = $props();

  const handleClose = async (albums?: AlbumResponseDto[]) => {
    const albumIds = (albums ?? []).map(({ id }) => id);
    if (albumIds.length === 0) {
      onClose();
      return;
    }

    const confirm = !isLocked &&
      (albums ?? []).some((album) => album.isLocked) && {
        title: $t('add_to_locked_album'),
        prompt: $t('add_to_locked_album_confirmation'),
        confirmText: $t('add'),
      };

    await executeMutation(addAssetsToAlbumsMutation, { albumIds, assetIds }, { confirm, onSuccess: onClose });
  };
</script>

<AlbumPickerModal selectedItemsCount={assetIds.length} showLocked lockedOnly={isLocked} onClose={handleClose} />
