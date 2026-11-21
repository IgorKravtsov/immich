import { getAlbumInfoQuery } from '#lib/queries/album.query.ts';
import { getAuthStatusQuery } from '#lib/queries/auth.query.ts';
import { queryClient } from '#lib/queries/client.ts';
import { Route } from '#lib/route.ts';
import { authenticate } from '#lib/utils/auth.ts';
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load = (async ({ params, url }) => {
  await authenticate(url);

  const subPath = url.pathname.slice(Route.viewAlbum({ id: params.albumId }).length);
  const redirectToLockedAlbum = () =>
    redirect(307, Route.viewAlbum({ id: params.albumId, isLocked: true }) + subPath + url.search);

  const album = await queryClient
    .query({ ...getAlbumInfoQuery(params.albumId), staleTime: 0 })
    .catch(async (error: unknown) => {
      const { isElevated } = await queryClient.query(getAuthStatusQuery());
      if (!isElevated) {
        redirectToLockedAlbum();
      }
      throw error;
    });

  if (album.isLocked) {
    redirectToLockedAlbum();
  }

  return {
    meta: {
      title: album.albumName,
    },
  };
}) satisfies PageLoad;
