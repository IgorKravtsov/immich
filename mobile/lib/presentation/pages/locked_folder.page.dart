import 'dart:async';

import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:immich_mobile/domain/models/album/album.model.dart';
import 'package:immich_mobile/extensions/build_context_extensions.dart';
import 'package:immich_mobile/generated/translations.g.dart';
import 'package:immich_mobile/presentation/widgets/album/album_tile.dart';
import 'package:immich_mobile/presentation/widgets/album/new_album_name_modal.widget.dart';
import 'package:immich_mobile/presentation/widgets/bottom_sheet/locked_folder_bottom_sheet.widget.dart';
import 'package:immich_mobile/presentation/widgets/locked/locked_session_scope.widget.dart';
import 'package:immich_mobile/presentation/widgets/timeline/timeline.widget.dart';
import 'package:immich_mobile/providers/infrastructure/album.provider.dart';
import 'package:immich_mobile/providers/infrastructure/remote_album.provider.dart';
import 'package:immich_mobile/providers/infrastructure/timeline.provider.dart';
import 'package:immich_mobile/providers/user.provider.dart';
import 'package:immich_mobile/routing/router.dart';
import 'package:immich_mobile/utils/error_handler.dart';
import 'package:immich_mobile/widgets/common/mesmerizing_sliver_app_bar.dart';

enum LockedFolderTab { photos, albums }

@RoutePage()
class LockedFolderPage extends StatefulWidget {
  const LockedFolderPage({super.key});

  @override
  State<LockedFolderPage> createState() => _LockedFolderPageState();
}

class _LockedFolderPageState extends State<LockedFolderPage> {
  LockedFolderTab _tab = LockedFolderTab.photos;

  void _selectTab(LockedFolderTab tab) => setState(() => _tab = tab);

  @override
  Widget build(BuildContext context) {
    final tabBar = _LockedFolderTabBar(selected: _tab, onSelected: _selectTab);

    return LockedSessionScope(
      lockOnPop: true,
      child: ProviderScope(
        overrides: [
          timelineServiceProvider.overrideWith((ref) {
            final user = ref.watch(currentUserProvider);
            if (user == null) {
              throw Exception('User must be logged in to access locked folder');
            }

            final timelineService = ref.watch(timelineFactoryProvider).lockedFolder(user.id);
            ref.onDispose(timelineService.dispose);
            return timelineService;
          }),
        ],
        child: switch (_tab) {
          LockedFolderTab.photos => Timeline(
            appBar: MesmerizingSliverAppBar(title: context.t.locked_folder),
            topSliverWidget: SliverToBoxAdapter(child: tabBar),
            topSliverWidgetHeight: _LockedFolderTabBar.height,
            bottomSheet: const LockedFolderBottomSheet(),
          ),
          LockedFolderTab.albums => _LockedAlbumsView(tabBar: tabBar),
        },
      ),
    );
  }
}

class _LockedFolderTabBar extends StatelessWidget {
  static const double height = 56;

  final LockedFolderTab selected;
  final ValueChanged<LockedFolderTab> onSelected;

  const _LockedFolderTabBar({required this.selected, required this.onSelected});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: SegmentedButton<LockedFolderTab>(
          showSelectedIcon: false,
          segments: [
            ButtonSegment(
              value: LockedFolderTab.photos,
              label: Text(context.t.photos),
              icon: const Icon(Icons.photo_outlined),
            ),
            ButtonSegment(
              value: LockedFolderTab.albums,
              label: Text(context.t.albums),
              icon: const Icon(Icons.photo_album_outlined),
            ),
          ],
          selected: {selected},
          onSelectionChanged: (selection) => onSelected(selection.first),
        ),
      ),
    );
  }
}

class _LockedAlbumsView extends ConsumerWidget {
  final Widget tabBar;

  const _LockedAlbumsView({required this.tabBar});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final albumsAsync = ref.watch(lockedAlbumsProvider);
    final userId = ref.watch(currentUserProvider)?.id;

    Future<void> createAlbum() async {
      final name = await showDialog<String?>(context: context, builder: (_) => const NewAlbumNameModal());
      if (name == null || name.trim().isEmpty) {
        return;
      }

      try {
        await ref.read(remoteAlbumProvider.notifier).createAlbum(title: name.trim(), isLocked: true);
      } catch (error, stack) {
        handleError(error, stack: stack, description: 'Failed to create locked album');
      }
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(context.t.locked_folder),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_rounded),
            tooltip: context.t.create_album,
            onPressed: () => unawaited(createAlbum()),
          ),
        ],
      ),
      body: Column(
        children: [
          tabBar,
          Expanded(
            child: albumsAsync.when(
              data: (albums) => albums.isEmpty
                  ? Center(
                      child: Text(
                        context.t.locked_albums_empty,
                        style: context.textTheme.bodyLarge,
                        textAlign: TextAlign.center,
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      itemCount: albums.length,
                      itemBuilder: (context, index) {
                        final album = albums[index];
                        return AlbumTile(
                          album: album,
                          isOwner: album.ownerId == userId,
                          onAlbumSelected: (RemoteAlbum selected) =>
                              unawaited(context.pushRoute(LockedAlbumRoute(album: selected))),
                        );
                      },
                    ),
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _) => Center(child: Text(error.toString())),
            ),
          ),
        ],
      ),
    );
  }
}
