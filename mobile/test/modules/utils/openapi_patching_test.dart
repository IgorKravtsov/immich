import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:immich_mobile/utils/openapi_patching.dart';
import 'package:openapi/api.dart';

void main() {
  group('Test OpenApi Patching', () {
    test('upgradeDto', () {
      dynamic value;
      String targetType;

      targetType = 'UserPreferencesResponseDto';
      value = jsonDecode("""
{
  "download": {
    "archiveSize": 4294967296,
    "includeEmbeddedVideos": false
  }
}
""");

      upgradeDto(value, targetType);
      expect(value['tags'], TagsResponse(enabled: false, sidebarWeb: false).toJson());
      expect(value['download']['includeEmbeddedVideos'], false);
    });

    test('SyncAlbumV2 from a server without locked albums defaults isLocked to false', () {
      final album = SyncAlbumV2.fromJson({
        'createdAt': '2026-01-01T00:00:00.000Z',
        'description': '',
        'id': 'album-1',
        'isActivityEnabled': true,
        'name': 'Album',
        'order': 'desc',
        'thumbnailAssetId': null,
        'updatedAt': '2026-01-01T00:00:00.000Z',
      });

      expect(album?.isLocked, isFalse);
    });

    test('AlbumResponseDto upgrade adds isLocked', () {
      final dynamic value = <String, dynamic>{'id': 'album-1'};

      upgradeDto(value, 'AlbumResponseDto');

      expect(value['isLocked'], isFalse);
    });

    test('addDefault', () {
      final dynamic value = jsonDecode("""
{
  "download": {
    "archiveSize": 4294967296,
    "includeEmbeddedVideos": false
  }
}
""");
      String keys = 'download.unknownKey';
      dynamic defaultValue = 69420;

      addDefault(value, keys, defaultValue);
      expect(value['download']['unknownKey'], 69420);

      keys = 'alpha.beta';
      defaultValue = 'gamma';
      addDefault(value, keys, defaultValue);
      expect(value['alpha']['beta'], 'gamma');
    });

    test('addDefault with null', () {
      final dynamic value = jsonDecode("""
{
  "download": {
    "archiveSize": 4294967296,
    "includeEmbeddedVideos": false
  }
}
""");
      expect(value['download']['unknownKey'], isNull);
    });
  });
}
