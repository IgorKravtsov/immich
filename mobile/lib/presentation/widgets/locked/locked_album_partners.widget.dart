import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:immich_mobile/domain/models/album/album.model.dart';
import 'package:immich_mobile/domain/models/user.model.dart';
import 'package:immich_mobile/extensions/build_context_extensions.dart';
import 'package:immich_mobile/extensions/theme_extensions.dart';
import 'package:immich_mobile/generated/translations.g.dart';
import 'package:immich_mobile/presentation/widgets/locked/elevated_session.dart';
import 'package:immich_mobile/presentation/widgets/people/partner_user_avatar.widget.dart';
import 'package:immich_mobile/providers/infrastructure/album.provider.dart';
import 'package:immich_mobile/providers/infrastructure/remote_album.provider.dart';
import 'package:immich_mobile/providers/infrastructure/user.provider.dart';
import 'package:immich_mobile/providers/user.provider.dart';
import 'package:immich_mobile/utils/error_handler.dart';

final sharingPartnersProvider = StreamProvider.autoDispose<List<Partner>>((ref) {
  final userId = ref.watch(currentUserProvider)?.id;
  if (userId == null) {
    return const Stream.empty();
  }

  return ref.watch(partnerServiceProvider).search(userId, .sharedBy).map((partners) => partners.toList());
});

class LockedAlbumPartnersSection extends ConsumerWidget {
  final RemoteAlbum album;

  const LockedAlbumPartnersSection({super.key, required this.album});

  Future<void> _toggle(BuildContext context, WidgetRef ref, Partner partner, bool shouldShare) async {
    if (!await ensureElevatedSession(context, ref)) {
      return;
    }

    final notifier = ref.read(remoteAlbumProvider.notifier);
    try {
      if (shouldShare) {
        await notifier.addUsers(album.id, [partner.id], role: AlbumUserRole.viewer);
      } else {
        await notifier.removeUser(album.id, partner.id);
      }
    } catch (error, stack) {
      handleError(error, stack: stack, description: 'Failed to update partner access to locked album');
    }
    ref.invalidate(remoteAlbumSharedUsersProvider(album.id));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final partnersAsync = ref.watch(sharingPartnersProvider);
    final sharedUsersAsync = ref.watch(remoteAlbumSharedUsersProvider(album.id));

    final partners = partnersAsync.valueOrNull;
    final sharedUserIds = sharedUsersAsync.valueOrNull?.map((user) => user.id).toSet();
    if (partners == null || sharedUserIds == null) {
      return const Center(child: CircularProgressIndicator());
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.all(16.0),
          child: Text(context.t.partners, style: context.textTheme.bodySmall),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0),
          child: Text(
            partners.isEmpty ? context.t.locked_no_partners : context.t.locked_album_partners_description,
            style: context.textTheme.labelLarge?.copyWith(color: context.colorScheme.onSurfaceSecondary),
          ),
        ),
        for (final partner in partners)
          CheckboxListTile(
            value: sharedUserIds.contains(partner.id),
            onChanged: (value) => _toggle(context, ref, partner, value ?? false),
            secondary: PartnerUserAvatar(userId: partner.id, name: partner.name),
            title: Text(partner.name, style: const TextStyle(fontWeight: FontWeight.w500)),
            subtitle: Text(partner.email),
          ),
      ],
    );
  }
}
