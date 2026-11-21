import { getAlbumInfoQuery } from '#lib/queries/album.query.ts';
import { queryClient } from '#lib/queries/client.ts';
import { Route } from '#lib/route.ts';
import { authenticateElevated } from '#lib/utils/auth.ts';
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load = (async ({ params, url }) => {
  await authenticateElevated(url);

  const album = await queryClient.query({ ...getAlbumInfoQuery(params.albumId), staleTime: 0 });
  if (!album.isLocked) {
    const subPath = url.pathname.slice(Route.viewAlbum({ id: album.id, isLocked: true }).length);
    redirect(307, Route.viewAlbum(album) + subPath + url.search);
  }

  return {
    meta: {
      title: album.albumName,
    },
  };
}) satisfies PageLoad;
