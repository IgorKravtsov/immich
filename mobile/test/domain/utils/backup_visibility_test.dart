import 'package:flutter_test/flutter_test.dart';
import 'package:immich_mobile/domain/models/asset/base_asset.model.dart';
import 'package:immich_mobile/domain/utils/backup_visibility.dart';

void main() {
  group('backupUploadVisibility', () {
    test('leaves the visibility to the server for a regular backup', () {
      expect(backupUploadVisibility(isLivePhotoMotion: false, isInLockedAlbum: false), isNull);
    });

    test('uploads assets of a backup album linked to a locked album as locked', () {
      expect(backupUploadVisibility(isLivePhotoMotion: false, isInLockedAlbum: true), AssetVisibility.locked);
    });

    test('keeps the motion part of a live photo hidden', () {
      expect(backupUploadVisibility(isLivePhotoMotion: true, isInLockedAlbum: false), AssetVisibility.hidden);
      expect(backupUploadVisibility(isLivePhotoMotion: true, isInLockedAlbum: true), AssetVisibility.hidden);
    });
  });
}
