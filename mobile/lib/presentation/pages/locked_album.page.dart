import 'package:auto_route/auto_route.dart';
import 'package:flutter/widgets.dart';
import 'package:immich_mobile/domain/models/album/album.model.dart';
import 'package:immich_mobile/presentation/pages/remote_album.page.dart';
import 'package:immich_mobile/presentation/widgets/locked/locked_session_scope.widget.dart';
import 'package:immich_mobile/routing/router.dart';

PageRouteInfo albumRoute(RemoteAlbum album) =>
    album.isLocked ? LockedAlbumRoute(album: album) : RemoteAlbumRoute(album: album);

@RoutePage()
class LockedAlbumPage extends StatelessWidget {
  final RemoteAlbum album;

  const LockedAlbumPage({super.key, required this.album});

  @override
  Widget build(BuildContext context) {
    return LockedSessionScope(child: RemoteAlbumPage(album: album));
  }
}
