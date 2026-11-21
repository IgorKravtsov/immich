import 'package:flutter_test/flutter_test.dart';
import 'package:immich_mobile/domain/models/asset/base_asset.model.dart';
import 'package:immich_mobile/domain/utils/album_cover.dart';

import '../../unit/factories/remote_album_factory.dart';
import '../../unit/factories/remote_asset_factory.dart';

void main() {
  final regularAlbum = RemoteAlbumFactory.create();
  final lockedAlbum = RemoteAlbumFactory.create().copyWith(isLocked: true);
  final timelineCover = RemoteAssetFactory.create();
  final lockedCover = RemoteAssetFactory.create(visibility: AssetVisibility.locked);

  test('a regular album hides a locked cover', () {
    expect(visibleAlbumCover(regularAlbum, lockedCover), isNull);
  });

  test('a regular album shows a timeline cover', () {
    expect(visibleAlbumCover(regularAlbum, timelineCover), timelineCover);
  });

  test('a locked album shows a locked cover', () {
    expect(visibleAlbumCover(lockedAlbum, lockedCover), lockedCover);
  });

  test('a missing cover stays missing', () {
    expect(visibleAlbumCover(lockedAlbum, null), isNull);
  });
}
