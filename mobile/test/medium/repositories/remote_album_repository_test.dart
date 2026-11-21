import 'package:flutter_test/flutter_test.dart';
import 'package:immich_mobile/constants/enums.dart';
import 'package:immich_mobile/domain/models/album/album.model.dart';
import 'package:immich_mobile/domain/models/asset/base_asset.model.dart';
import 'package:immich_mobile/infrastructure/repositories/remote_album.repository.dart';

import '../../unit/factories/local_asset_factory.dart';
import '../../unit/factories/remote_album_factory.dart';
import '../repository_context.dart';

void main() {
  late MediumRepositoryContext ctx;
  late RemoteAlbumRepository sut;

  setUp(() async {
    ctx = MediumRepositoryContext();
    sut = RemoteAlbumRepository(ctx.db);
  });

  tearDown(() async {
    await ctx.dispose();
  });

  group('addAssets', () {
    test('sets the first added asset as thumbnail when the album has no thumbnail', () async {
      final user = await ctx.newUser();
      final album = await ctx.newRemoteAlbum(ownerId: user.id);
      final asset = await ctx.newRemoteAsset(ownerId: user.id);

      await sut.addAssets(album.id, [asset.id]);

      final updated = await sut.get(album.id);
      expect(updated?.thumbnailAssetId, asset.id);
      expect(updated?.assetCount, 1);
    });

    test('preserves an existing thumbnail when adding assets', () async {
      final user = await ctx.newUser();
      final thumbnail = await ctx.newRemoteAsset(ownerId: user.id);
      final album = await ctx.newRemoteAlbum(ownerId: user.id, thumbnailAssetId: thumbnail.id);
      final asset = await ctx.newRemoteAsset(ownerId: user.id);

      await sut.addAssets(album.id, [asset.id]);

      final updated = await sut.get(album.id);
      expect(updated?.thumbnailAssetId, thumbnail.id);
      expect(updated?.assetCount, 1);
    });
  });

  group('locked albums', () {
    test('getAll leaves out locked albums by default', () async {
      final user = await ctx.newUser();
      final regular = await ctx.newRemoteAlbum(ownerId: user.id);
      await ctx.newRemoteAlbum(ownerId: user.id, isLocked: true);

      final albums = await sut.getAll();

      expect(albums.map((album) => album.id), [regular.id]);
      expect(albums.single.isLocked, isFalse);
    });

    test('getAll returns only locked albums when asked for them', () async {
      final user = await ctx.newUser();
      await ctx.newRemoteAlbum(ownerId: user.id);
      final locked = await ctx.newRemoteAlbum(ownerId: user.id, isLocked: true);

      final albums = await sut.getAll(isLocked: true);

      expect(albums.map((album) => album.id), [locked.id]);
      expect(albums.single.isLocked, isTrue);
    });

    test('watchLocked emits own and shared locked albums', () async {
      final user = await ctx.newUser();
      final partner = await ctx.newUser();
      final own = await ctx.newRemoteAlbum(ownerId: user.id, isLocked: true);
      final shared = await ctx.newRemoteAlbum(ownerId: partner.id, isLocked: true);
      await ctx.newRemoteAlbum(ownerId: partner.id);

      final albums = await sut.watchLocked().first;

      expect(albums.map((album) => album.id), unorderedEquals([own.id, shared.id]));
    });

    test('watchLockedAlbumIds reflects the locked flag', () async {
      final user = await ctx.newUser();
      final locked = await ctx.newRemoteAlbum(ownerId: user.id, isLocked: true);
      await ctx.newRemoteAlbum(ownerId: user.id);

      expect(await sut.watchLockedAlbumIds().first, {locked.id});
    });

    test('updateAlbum persists the locked flag', () async {
      final user = await ctx.newUser();
      final album = await ctx.newRemoteAlbum(ownerId: user.id);
      final existing = (await sut.get(album.id))!;

      await sut.updateAlbum(existing.copyWith(isLocked: true));

      expect((await sut.get(album.id))?.isLocked, isTrue);
      expect(await sut.getAll(), isEmpty);
    });

    test('addUsers stores the requested role', () async {
      final user = await ctx.newUser();
      final partner = await ctx.newUser();
      final album = await ctx.newRemoteAlbum(ownerId: user.id, isLocked: true);

      await sut.addUsers(album.id, [partner.id], role: .viewer);

      expect(await sut.getUserRole(album.id, partner.id), AlbumUserRole.viewer);
    });
  });

  group('lock state reconciliation', () {
    Future<AssetVisibility> visibilityOf(String assetId) async =>
        (await ctx.db.managers.remoteAssetEntity.filter((row) => row.id.equals(assetId)).getSingle()).visibility;

    Future<Set<String>> assetIdsIn(String albumId) async =>
        (await ctx.db.managers.remoteAlbumAssetEntity.filter((row) => row.albumId.id.equals(albumId)).get())
            .map((row) => row.assetId)
            .toSet();

    test('locking an album locks own assets, drops them from regular albums and removes foreign assets', () async {
      final user = await ctx.newUser();
      final other = await ctx.newUser();
      final album = await ctx.newRemoteAlbum(ownerId: user.id);
      final regular = await ctx.newRemoteAlbum(ownerId: user.id);
      final otherLocked = await ctx.newRemoteAlbum(ownerId: user.id, isLocked: true);
      final own = await ctx.newRemoteAsset(ownerId: user.id);
      final foreign = await ctx.newRemoteAsset(ownerId: other.id);
      final unrelated = await ctx.newRemoteAsset(ownerId: user.id);
      final ownLocked = await ctx.newRemoteAsset(ownerId: user.id, visibility: .locked);
      await ctx.newRemoteAlbumAsset(albumId: album.id, assetId: own.id);
      await ctx.newRemoteAlbumAsset(albumId: album.id, assetId: foreign.id);
      await ctx.newRemoteAlbumAsset(albumId: regular.id, assetId: own.id);
      await ctx.newRemoteAlbumAsset(albumId: regular.id, assetId: foreign.id);
      await ctx.newRemoteAlbumAsset(albumId: regular.id, assetId: unrelated.id);
      await ctx.newRemoteAlbumAsset(albumId: otherLocked.id, assetId: ownLocked.id);

      final existing = (await sut.get(album.id))!;
      await sut.applyLockState(existing.copyWith(isLocked: true));

      expect((await sut.get(album.id))?.isLocked, isTrue);
      expect(await assetIdsIn(album.id), {own.id});
      expect(await assetIdsIn(regular.id), {foreign.id, unrelated.id});
      expect(await assetIdsIn(otherLocked.id), {ownLocked.id});
      expect(await visibilityOf(own.id), AssetVisibility.locked);
      expect(await visibilityOf(foreign.id), AssetVisibility.timeline);
      expect(await visibilityOf(unrelated.id), AssetVisibility.timeline);
    });

    test('unlocking an album follows D4', () async {
      final user = await ctx.newUser();
      final other = await ctx.newUser();
      final album = await ctx.newRemoteAlbum(ownerId: user.id, isLocked: true);
      final anotherLocked = await ctx.newRemoteAlbum(ownerId: user.id, isLocked: true);
      final onlyHere = await ctx.newRemoteAsset(ownerId: user.id, visibility: .locked);
      final alsoElsewhere = await ctx.newRemoteAsset(ownerId: user.id, visibility: .locked);
      final foreign = await ctx.newRemoteAsset(ownerId: other.id, visibility: .locked);
      await ctx.newRemoteAlbumAsset(albumId: album.id, assetId: onlyHere.id);
      await ctx.newRemoteAlbumAsset(albumId: album.id, assetId: alsoElsewhere.id);
      await ctx.newRemoteAlbumAsset(albumId: album.id, assetId: foreign.id);
      await ctx.newRemoteAlbumAsset(albumId: anotherLocked.id, assetId: alsoElsewhere.id);

      final existing = (await sut.get(album.id))!;
      await sut.applyLockState(existing.copyWith(isLocked: false));

      expect((await sut.get(album.id))?.isLocked, isFalse);
      expect(await assetIdsIn(album.id), {onlyHere.id});
      expect(await assetIdsIn(anotherLocked.id), {alsoElsewhere.id});
      expect(await visibilityOf(onlyHere.id), AssetVisibility.timeline);
      expect(await visibilityOf(alsoElsewhere.id), AssetVisibility.locked);
      expect(await visibilityOf(foreign.id), AssetVisibility.locked);
    });

    test('adding assets to a locked album locks them and drops them from regular albums', () async {
      final user = await ctx.newUser();
      final album = await ctx.newRemoteAlbum(ownerId: user.id, isLocked: true);
      final regular = await ctx.newRemoteAlbum(ownerId: user.id);
      final asset = await ctx.newRemoteAsset(ownerId: user.id);
      await ctx.newRemoteAlbumAsset(albumId: regular.id, assetId: asset.id);

      await sut.addAssets(album.id, [asset.id]);

      expect(await assetIdsIn(album.id), {asset.id});
      expect(await assetIdsIn(regular.id), isEmpty);
      expect(await visibilityOf(asset.id), AssetVisibility.locked);
    });

    test('adding assets to a regular album keeps their visibility', () async {
      final user = await ctx.newUser();
      final album = await ctx.newRemoteAlbum(ownerId: user.id);
      final other = await ctx.newRemoteAlbum(ownerId: user.id);
      final asset = await ctx.newRemoteAsset(ownerId: user.id);
      await ctx.newRemoteAlbumAsset(albumId: other.id, assetId: asset.id);

      await sut.addAssets(album.id, [asset.id]);

      expect(await assetIdsIn(other.id), {asset.id});
      expect(await visibilityOf(asset.id), AssetVisibility.timeline);
    });

    test('creating a locked album locks its assets', () async {
      final user = await ctx.newUser();
      final regular = await ctx.newRemoteAlbum(ownerId: user.id);
      final asset = await ctx.newRemoteAsset(ownerId: user.id);
      await ctx.newRemoteAlbumAsset(albumId: regular.id, assetId: asset.id);
      final album = RemoteAlbumFactory.create(ownerId: user.id).copyWith(isLocked: true);

      await sut.create(album, [asset.id]);

      expect(await assetIdsIn(album.id), {asset.id});
      expect(await assetIdsIn(regular.id), isEmpty);
      expect(await visibilityOf(asset.id), AssetVisibility.locked);
    });

    test('upsertRemoteAssetStub stores the requested visibility', () async {
      final user = await ctx.newUser();

      await sut.upsertRemoteAssetStub(
        remoteId: 'stub',
        ownerId: user.id,
        source: LocalAssetFactory.create(id: 'local'),
        visibility: AssetVisibility.locked,
      );

      expect(await visibilityOf('stub'), AssetVisibility.locked);
    });

    test('isLocked reports the album flag', () async {
      final user = await ctx.newUser();
      final locked = await ctx.newRemoteAlbum(ownerId: user.id, isLocked: true);
      final regular = await ctx.newRemoteAlbum(ownerId: user.id);

      expect(await sut.isLocked(locked.id), isTrue);
      expect(await sut.isLocked(regular.id), isFalse);
      expect(await sut.isLocked('missing'), isFalse);
    });
  });

  group('locked assets in regular albums', () {
    Future<String> seedRegularAlbumWithLockedAsset() async {
      final user = await ctx.newUser();
      final album = await ctx.newRemoteAlbum(ownerId: user.id);
      final visible = await ctx.newRemoteAsset(ownerId: user.id);
      final locked = await ctx.newRemoteAsset(ownerId: user.id, visibility: .locked);
      await ctx.newRemoteAlbumAsset(albumId: album.id, assetId: visible.id);
      await ctx.newRemoteAlbumAsset(albumId: album.id, assetId: locked.id);
      return album.id;
    }

    test('are left out of getAll counts', () async {
      final albumId = await seedRegularAlbumWithLockedAsset();

      expect((await sut.getAll()).singleWhere((album) => album.id == albumId).assetCount, 1);
    });

    test('are left out of get counts', () async {
      final albumId = await seedRegularAlbumWithLockedAsset();

      expect((await sut.get(albumId))?.assetCount, 1);
    });

    test('are left out of getAlbumsContainingAsset counts', () async {
      final albumId = await seedRegularAlbumWithLockedAsset();
      final visibleId = (await sut.getAssets(albumId)).firstWhere((asset) => !asset.isLocked).id;

      expect((await sut.getAlbumsContainingAsset(visibleId)).single.assetCount, 1);
    });

    test('still count inside locked albums', () async {
      final user = await ctx.newUser();
      final album = await ctx.newRemoteAlbum(ownerId: user.id, isLocked: true);
      final locked = await ctx.newRemoteAsset(ownerId: user.id, visibility: .locked);
      await ctx.newRemoteAlbumAsset(albumId: album.id, assetId: locked.id);

      expect((await sut.getAll(isLocked: true)).single.assetCount, 1);
    });
  });

  group('getAll', () {
    test('returns album when all of its assets are trashed', () async {
      final user = await ctx.newUser();
      final album = await ctx.newRemoteAlbum(ownerId: user.id);
      final asset1 = await ctx.newRemoteAsset(ownerId: user.id, deletedAt: DateTime(2025, 1, 1));
      final asset2 = await ctx.newRemoteAsset(ownerId: user.id, deletedAt: DateTime(2025, 1, 1));
      await ctx.newRemoteAlbumAsset(albumId: album.id, assetId: asset1.id);
      await ctx.newRemoteAlbumAsset(albumId: album.id, assetId: asset2.id);

      final albums = await sut.getAll();

      expect(albums, hasLength(1));
      expect(albums.first.id, album.id);
      expect(albums.first.assetCount, 0);
    });

    test('excludes trashed assets from assetCount', () async {
      final user = await ctx.newUser();
      final album = await ctx.newRemoteAlbum(ownerId: user.id);
      final active1 = await ctx.newRemoteAsset(ownerId: user.id);
      final active2 = await ctx.newRemoteAsset(ownerId: user.id);
      final trashed = await ctx.newRemoteAsset(ownerId: user.id, deletedAt: DateTime(2025, 1, 1));
      await ctx.newRemoteAlbumAsset(albumId: album.id, assetId: active1.id);
      await ctx.newRemoteAlbumAsset(albumId: album.id, assetId: active2.id);
      await ctx.newRemoteAlbumAsset(albumId: album.id, assetId: trashed.id);

      final albums = await sut.getAll();

      expect(albums, hasLength(1));
      expect(albums.first.assetCount, 2);
    });

    test('returns album without assets', () async {
      final user = await ctx.newUser();
      final album = await ctx.newRemoteAlbum(ownerId: user.id);

      final albums = await sut.getAll();

      expect(albums, hasLength(1));
      expect(albums.first.id, album.id);
      expect(albums.first.assetCount, 0);
    });
  });

  group('get', () {
    test('returns the album when all of its assets are trashed', () async {
      final user = await ctx.newUser();
      final album = await ctx.newRemoteAlbum(ownerId: user.id);
      final asset = await ctx.newRemoteAsset(ownerId: user.id, deletedAt: DateTime(2025, 1, 1));
      await ctx.newRemoteAlbumAsset(albumId: album.id, assetId: asset.id);

      final result = await sut.get(album.id);

      expect(result, isNotNull);
      expect(result?.id, album.id);
      expect(result?.assetCount, 0);
    });
  });

  group('getAlbumsContainingAsset', () {
    test('excludes trashed assets from assetCount', () async {
      final user = await ctx.newUser();
      final album = await ctx.newRemoteAlbum(ownerId: user.id);
      final asset = await ctx.newRemoteAsset(ownerId: user.id);
      final trashed = await ctx.newRemoteAsset(ownerId: user.id, deletedAt: DateTime(2025, 1, 1));
      await ctx.newRemoteAlbumAsset(albumId: album.id, assetId: asset.id);
      await ctx.newRemoteAlbumAsset(albumId: album.id, assetId: trashed.id);

      final albums = await sut.getAlbumsContainingAsset(asset.id);

      expect(albums, hasLength(1));
      expect(albums.first.id, album.id);
      expect(albums.first.assetCount, 1);
    });

    test('returns albums for a trashed asset', () async {
      final user = await ctx.newUser();
      final album = await ctx.newRemoteAlbum(ownerId: user.id);
      final trashed = await ctx.newRemoteAsset(ownerId: user.id, deletedAt: DateTime(2025, 1, 1));
      await ctx.newRemoteAlbumAsset(albumId: album.id, assetId: trashed.id);

      final albums = await sut.getAlbumsContainingAsset(trashed.id);

      expect(albums, hasLength(1));
      expect(albums.first.assetCount, 0);
    });
  });

  group('getSortedAlbumIds', () {
    late String userId;

    setUp(() async {
      final user = await ctx.newUser();
      userId = user.id;
    });

    test('returns empty list when albumIds is empty', () async {
      final result = await sut.getSortedAlbumIds([], aggregation: AssetDateAggregation.start);
      expect(result, isEmpty);
    });

    test('returns single album when only one album exists', () async {
      final album = await ctx.newRemoteAlbum(ownerId: userId);
      final asset = await ctx.newRemoteAsset(ownerId: userId, createdAt: DateTime(2024, 1, 1));
      await ctx.newRemoteAlbumAsset(albumId: album.id, assetId: asset.id);

      final result = await sut.getSortedAlbumIds([album.id], aggregation: AssetDateAggregation.start);
      expect(result, [album.id]);
    });

    test('sorts albums by start date (MIN) ascending', () async {
      // Album 1: Assets from Jan 10 to Jan 20 (start: Jan 10)
      final album1 = await ctx.newRemoteAlbum(ownerId: userId);
      final asset1 = await ctx.newRemoteAsset(ownerId: userId, createdAt: DateTime(2024, 1, 10));
      final asset2 = await ctx.newRemoteAsset(ownerId: userId, createdAt: DateTime(2024, 1, 20));
      await ctx.newRemoteAlbumAsset(albumId: album1.id, assetId: asset1.id);
      await ctx.newRemoteAlbumAsset(albumId: album1.id, assetId: asset2.id);

      // Album 2: Assets from Jan 5 to Jan 15 (start: Jan 5)
      final album2 = await ctx.newRemoteAlbum(ownerId: userId);
      final asset3 = await ctx.newRemoteAsset(ownerId: userId, createdAt: DateTime(2024, 1, 5));
      final asset4 = await ctx.newRemoteAsset(ownerId: userId, createdAt: DateTime(2024, 1, 15));
      await ctx.newRemoteAlbumAsset(albumId: album2.id, assetId: asset3.id);
      await ctx.newRemoteAlbumAsset(albumId: album2.id, assetId: asset4.id);

      // Album 3: Assets from Jan 25 to Jan 30 (start: Jan 25)
      final album3 = await ctx.newRemoteAlbum(ownerId: userId);
      final asset5 = await ctx.newRemoteAsset(ownerId: userId, createdAt: DateTime(2024, 1, 25));
      final asset6 = await ctx.newRemoteAsset(ownerId: userId, createdAt: DateTime(2024, 1, 30));
      await ctx.newRemoteAlbumAsset(albumId: album3.id, assetId: asset5.id);
      await ctx.newRemoteAlbumAsset(albumId: album3.id, assetId: asset6.id);

      final result = await sut.getSortedAlbumIds([
        album1.id,
        album2.id,
        album3.id,
      ], aggregation: AssetDateAggregation.start);

      // Expected order: album2 (Jan 5), album1 (Jan 10), album3 (Jan 25)
      expect(result, [album2.id, album1.id, album3.id]);
    });

    test('sorts albums by end date (MAX) ascending', () async {
      // Album 1: Assets from Jan 10 to Jan 20 (end: Jan 20)
      final album1 = await ctx.newRemoteAlbum(ownerId: userId);
      final asset1 = await ctx.newRemoteAsset(ownerId: userId, createdAt: DateTime(2024, 1, 10));
      final asset2 = await ctx.newRemoteAsset(ownerId: userId, createdAt: DateTime(2024, 1, 20));
      await ctx.newRemoteAlbumAsset(albumId: album1.id, assetId: asset1.id);
      await ctx.newRemoteAlbumAsset(albumId: album1.id, assetId: asset2.id);

      // Album 2: Assets from Jan 5 to Jan 15 (end: Jan 15)
      final album2 = await ctx.newRemoteAlbum(ownerId: userId);
      final asset3 = await ctx.newRemoteAsset(ownerId: userId, createdAt: DateTime(2024, 1, 5));
      final asset4 = await ctx.newRemoteAsset(ownerId: userId, createdAt: DateTime(2024, 1, 15));
      await ctx.newRemoteAlbumAsset(albumId: album2.id, assetId: asset3.id);
      await ctx.newRemoteAlbumAsset(albumId: album2.id, assetId: asset4.id);

      // Album 3: Assets from Jan 25 to Jan 30 (end: Jan 30)
      final album3 = await ctx.newRemoteAlbum(ownerId: userId);
      final asset5 = await ctx.newRemoteAsset(ownerId: userId, createdAt: DateTime(2024, 1, 25));
      final asset6 = await ctx.newRemoteAsset(ownerId: userId, createdAt: DateTime(2024, 1, 30));
      await ctx.newRemoteAlbumAsset(albumId: album3.id, assetId: asset5.id);
      await ctx.newRemoteAlbumAsset(albumId: album3.id, assetId: asset6.id);

      final result = await sut.getSortedAlbumIds([
        album1.id,
        album2.id,
        album3.id,
      ], aggregation: AssetDateAggregation.end);

      // Expected order: album2 (Jan 15), album1 (Jan 20), album3 (Jan 30)
      expect(result, [album2.id, album1.id, album3.id]);
    });

    test('handles albums with single asset', () async {
      final album1 = await ctx.newRemoteAlbum(ownerId: userId);
      final asset1 = await ctx.newRemoteAsset(ownerId: userId, createdAt: DateTime(2024, 1, 15));
      await ctx.newRemoteAlbumAsset(albumId: album1.id, assetId: asset1.id);

      final album2 = await ctx.newRemoteAlbum(ownerId: userId);
      final asset2 = await ctx.newRemoteAsset(ownerId: userId, createdAt: DateTime(2024, 1, 10));
      await ctx.newRemoteAlbumAsset(albumId: album2.id, assetId: asset2.id);

      final result = await sut.getSortedAlbumIds([album1.id, album2.id], aggregation: AssetDateAggregation.start);

      expect(result, [album2.id, album1.id]);
    });

    test('only returns requested album IDs in the result', () async {
      // Create 3 albums
      final album1 = await ctx.newRemoteAlbum(ownerId: userId);
      final asset1 = await ctx.newRemoteAsset(ownerId: userId, createdAt: DateTime(2024, 1, 10));
      await ctx.newRemoteAlbumAsset(albumId: album1.id, assetId: asset1.id);

      final album2 = await ctx.newRemoteAlbum(ownerId: userId);
      final asset2 = await ctx.newRemoteAsset(ownerId: userId, createdAt: DateTime(2024, 1, 5));
      await ctx.newRemoteAlbumAsset(albumId: album2.id, assetId: asset2.id);

      final album3 = await ctx.newRemoteAlbum(ownerId: userId);
      final asset3 = await ctx.newRemoteAsset(ownerId: userId, createdAt: DateTime(2024, 1, 15));
      await ctx.newRemoteAlbumAsset(albumId: album3.id, assetId: asset3.id);

      // Only request album1 and album3
      final result = await sut.getSortedAlbumIds([album1.id, album3.id], aggregation: AssetDateAggregation.start);

      // Should only return album1 and album3, not album2
      expect(result, [album1.id, album3.id]);
    });

    test('handles albums with same date correctly', () async {
      final sameDate = DateTime(2024, 1, 10);

      final album1 = await ctx.newRemoteAlbum(ownerId: userId);
      final asset1 = await ctx.newRemoteAsset(ownerId: userId, createdAt: sameDate);
      await ctx.newRemoteAlbumAsset(albumId: album1.id, assetId: asset1.id);

      final album2 = await ctx.newRemoteAlbum(ownerId: userId);
      final asset2 = await ctx.newRemoteAsset(ownerId: userId, createdAt: sameDate);
      await ctx.newRemoteAlbumAsset(albumId: album2.id, assetId: asset2.id);

      final result = await sut.getSortedAlbumIds([album1.id, album2.id], aggregation: AssetDateAggregation.start);

      // Both albums have the same date, so both should be returned
      expect(result, hasLength(2));
      expect(result, containsAll([album1.id, album2.id]));
    });

    test('handles albums across different years', () async {
      final album1 = await ctx.newRemoteAlbum(ownerId: userId);
      final asset1 = await ctx.newRemoteAsset(ownerId: userId, createdAt: DateTime(2023, 12, 25));
      await ctx.newRemoteAlbumAsset(albumId: album1.id, assetId: asset1.id);

      final album2 = await ctx.newRemoteAlbum(ownerId: userId);
      final asset2 = await ctx.newRemoteAsset(ownerId: userId, createdAt: DateTime(2024, 1, 5));
      await ctx.newRemoteAlbumAsset(albumId: album2.id, assetId: asset2.id);

      final album3 = await ctx.newRemoteAlbum(ownerId: userId);
      final asset3 = await ctx.newRemoteAsset(ownerId: userId, createdAt: DateTime(2025, 1, 1));
      await ctx.newRemoteAlbumAsset(albumId: album3.id, assetId: asset3.id);

      final result = await sut.getSortedAlbumIds([
        album1.id,
        album2.id,
        album3.id,
      ], aggregation: AssetDateAggregation.start);

      expect(result, [album1.id, album2.id, album3.id]);
    });

    test('handles album with multiple assets correctly', () async {
      final album1 = await ctx.newRemoteAlbum(ownerId: userId);
      // Album 1 has 5 assets from Jan 5 to Jan 25
      final asset1 = await ctx.newRemoteAsset(ownerId: userId, createdAt: DateTime(2024, 1, 5));
      final asset2 = await ctx.newRemoteAsset(ownerId: userId, createdAt: DateTime(2024, 1, 10));
      final asset3 = await ctx.newRemoteAsset(ownerId: userId, createdAt: DateTime(2024, 1, 15));
      final asset4 = await ctx.newRemoteAsset(ownerId: userId, createdAt: DateTime(2024, 1, 20));
      final asset5 = await ctx.newRemoteAsset(ownerId: userId, createdAt: DateTime(2024, 1, 25));
      await ctx.newRemoteAlbumAsset(albumId: album1.id, assetId: asset1.id);
      await ctx.newRemoteAlbumAsset(albumId: album1.id, assetId: asset2.id);
      await ctx.newRemoteAlbumAsset(albumId: album1.id, assetId: asset3.id);
      await ctx.newRemoteAlbumAsset(albumId: album1.id, assetId: asset4.id);
      await ctx.newRemoteAlbumAsset(albumId: album1.id, assetId: asset5.id);

      final album2 = await ctx.newRemoteAlbum(ownerId: userId);
      final asset6 = await ctx.newRemoteAsset(ownerId: userId, createdAt: DateTime(2024, 1, 1));
      await ctx.newRemoteAlbumAsset(albumId: album2.id, assetId: asset6.id);

      final resultStart = await sut.getSortedAlbumIds([album1.id, album2.id], aggregation: AssetDateAggregation.start);

      // album2 (Jan 1) should come before album1 (Jan 5)
      expect(resultStart, [album2.id, album1.id]);

      final resultEnd = await sut.getSortedAlbumIds([album1.id, album2.id], aggregation: AssetDateAggregation.end);

      // album2 (Jan 1) should come before album1 (Jan 25)
      expect(resultEnd, [album2.id, album1.id]);
    });
  });
}
