import { authenticateElevated } from '#lib/utils/auth.ts';
import { getFormatter } from '#lib/utils/i18n.ts';
import type { PageLoad } from './$types';

export const load = (async ({ url }) => {
  await authenticateElevated(url);

  const $t = await getFormatter();

  return {
    meta: {
      title: $t('locked_folder'),
    },
  };
}) satisfies PageLoad;
