import 'package:flutter_test/flutter_test.dart';
import 'package:immich_mobile/models/shared_link/shared_link.model.dart';
import 'package:openapi/api.dart';

SharedLinkResponseDto _albumLink({required bool isLocked}) {
  final now = DateTime(2026, 1, 1);
  return SharedLinkResponseDto(
    album: Optional.present(
      AlbumResponseDto(
        albumName: 'Secret',
        albumThumbnailAssetId: 'thumb-id',
        assetCount: 1,
        createdAt: now,
        description: '',
        hasSharedLink: true,
        id: 'album-id',
        isActivityEnabled: false,
        isLocked: isLocked,
        shared: true,
        updatedAt: now,
      ),
    ),
    allowDownload: true,
    allowUpload: false,
    createdAt: now,
    description: null,
    expiresAt: null,
    id: 'link-id',
    key: 'key',
    password: 'secret',
    showMetadata: true,
    slug: null,
    type: SharedLinkType.ALBUM,
    userId: 'user-id',
  );
}

void main() {
  group('SharedLink.fromDto', () {
    test('marks a link to a locked album as locked', () {
      expect(SharedLink.fromDto(_albumLink(isLocked: true)).isLocked, isTrue);
    });

    test('does not mark a link to a regular album as locked', () {
      expect(SharedLink.fromDto(_albumLink(isLocked: false)).isLocked, isFalse);
    });
  });
}
