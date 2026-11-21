import 'package:flutter_test/flutter_test.dart';
import 'package:immich_mobile/domain/models/asset/base_asset.model.dart';
import 'package:immich_mobile/domain/services/remote_album.service.dart';
import 'package:immich_mobile/services/foreground_upload.service.dart';
import 'package:mocktail/mocktail.dart';

import '../../fixtures/user.stub.dart';
import '../../service.mocks.dart';
import '../factories/local_asset_factory.dart';
import '../factories/remote_album_factory.dart';
import '../mocks.dart';

void main() {
  late RemoteAlbumService sut;
  late MockForegroundUploadService uploadService;
  final mocks = RepositoryMocks();
  final owner = UserStub.admin;

  setUpAll(() {
    registerFallbackValue(<String>[]);
    registerFallbackValue(RemoteAlbumFactory.create());
    registerFallbackValue(LocalAssetFactory.create());
    registerFallbackValue(owner);
    registerFallbackValue(const UploadCallbacks());
    registerFallbackValue(AssetVisibility.timeline);
  });

  setUp(() {
    uploadService = MockForegroundUploadService();
    sut = RemoteAlbumService(mocks.remoteAlbum, mocks.albumApi, uploadService);
  });

  tearDown(() {
    mocks.resetAll();
  });

  group('RemoteAlbumService', () {
    group('removeAssets', () {
      test('persists only the assets the server actually removed, not the whole request', () async {
        const albumId = 'album-1';
        const requested = ['asset-1', 'asset-2', 'asset-3'];
        const removed = ['asset-1', 'asset-3'];

        // The server rejected 'asset-2'
        when(
          () => mocks.albumApi.removeAssets(albumId, requested),
        ).thenAnswer((_) async => (removed: removed, failed: ['asset-2']));
        when(() => mocks.remoteAlbum.removeAssets(albumId, any())).thenAnswer((_) async {});

        final count = await sut.removeAssets(albumId: albumId, assetIds: requested);

        final persisted =
            verify(() => mocks.remoteAlbum.removeAssets(albumId, captureAny())).captured.single as List<String>;
        expect(persisted, removed);
        expect(persisted, isNot(contains('asset-2')));

        expect(count, removed.length);
      });
    });

    group('setLocked', () {
      const albumId = 'album-1';

      setUp(() {
        when(() => mocks.remoteAlbum.getOwner(albumId)).thenAnswer((_) async => owner);
        when(() => mocks.remoteAlbum.applyLockState(any())).thenAnswer((_) async {});
        when(() => mocks.remoteAlbum.updateAlbum(any())).thenAnswer((_) async {});
      });

      for (final isLocked in [true, false]) {
        test('reconciles local assets when the server applies isLocked=$isLocked', () async {
          final updated = RemoteAlbumFactory.create(id: albumId, ownerId: owner.id).copyWith(isLocked: isLocked);
          when(() => mocks.albumApi.updateAlbum(albumId, owner, isLocked: isLocked)).thenAnswer((_) async => updated);

          final result = await sut.setLocked(albumId, isLocked: isLocked);

          expect(result.isLocked, isLocked);
          verify(() => mocks.remoteAlbum.applyLockState(updated)).called(1);
        });

        test('fails closed when the server ignores isLocked=$isLocked', () async {
          final ignored = RemoteAlbumFactory.create(id: albumId, ownerId: owner.id).copyWith(isLocked: !isLocked);
          when(() => mocks.albumApi.updateAlbum(albumId, owner, isLocked: isLocked)).thenAnswer((_) async => ignored);

          await expectLater(
            sut.setLocked(albumId, isLocked: isLocked),
            throwsA(isA<LockedAlbumStateNotAppliedException>()),
          );
          verifyNever(() => mocks.remoteAlbum.applyLockState(any()));
          verify(() => mocks.remoteAlbum.updateAlbum(ignored)).called(1);
        });
      }
    });

    group('createAlbum', () {
      test('discards an album the server created without the locked state', () async {
        final created = RemoteAlbumFactory.create(id: 'album-1', ownerId: owner.id);
        when(
          () => mocks.albumApi.createDriftAlbum(
            'Secret',
            owner,
            description: any(named: 'description'),
            assetIds: any(named: 'assetIds'),
            isLocked: true,
          ),
        ).thenAnswer((_) async => created);
        when(() => mocks.albumApi.deleteAlbum(created.id)).thenAnswer((_) async {});

        await expectLater(
          sut.createAlbum(title: 'Secret', owner: owner, assetIds: const [], isLocked: true),
          throwsA(isA<LockedAlbumStateNotAppliedException>()),
        );
        verify(() => mocks.albumApi.deleteAlbum(created.id)).called(1);
        verifyNever(() => mocks.remoteAlbum.create(any(), any()));
      });

      test('stores a locked album the server created as locked', () async {
        final created = RemoteAlbumFactory.create(id: 'album-1', ownerId: owner.id).copyWith(isLocked: true);
        when(
          () => mocks.albumApi.createDriftAlbum(
            'Secret',
            owner,
            description: any(named: 'description'),
            assetIds: any(named: 'assetIds'),
            isLocked: true,
          ),
        ).thenAnswer((_) async => created);
        when(() => mocks.remoteAlbum.create(any(), any())).thenAnswer((_) async {});

        final result = await sut.createAlbum(title: 'Secret', owner: owner, assetIds: const [], isLocked: true);

        expect(result.isLocked, isTrue);
        verify(() => mocks.remoteAlbum.create(created, const [])).called(1);
      });
    });

    group('adding local assets', () {
      const albumId = 'album-1';
      final source = LocalAssetFactory.create(id: 'local-1');

      setUp(() {
        when(
          () => mocks.albumApi.addAssets(albumId, ['remote-1']),
        ).thenAnswer((_) async => (added: ['remote-1'], failed: <String>[]));
        when(
          () => mocks.remoteAlbum.upsertRemoteAssetStub(
            remoteId: any(named: 'remoteId'),
            ownerId: any(named: 'ownerId'),
            source: any(named: 'source'),
            visibility: any(named: 'visibility'),
          ),
        ).thenAnswer((_) async {});
        when(() => mocks.remoteAlbum.addAssets(albumId, any())).thenAnswer((_) async => 1);
      });

      for (final (isLocked, visibility) in [(true, AssetVisibility.locked), (false, AssetVisibility.timeline)]) {
        test('uploads and stubs with $visibility visibility when the album isLocked=$isLocked', () async {
          when(() => mocks.remoteAlbum.isLocked(albumId)).thenAnswer((_) async => isLocked);
          when(
            () => uploadService.uploadManual(
              any(),
              cancelToken: any(named: 'cancelToken'),
              callbacks: any(named: 'callbacks'),
              toLockedAlbum: any(named: 'toLockedAlbum'),
            ),
          ).thenAnswer((invocation) async {
            final callbacks = invocation.namedArguments[#callbacks] as UploadCallbacks;
            callbacks.onSuccess?.call(source.id, 'remote-1');
          });

          final added = await sut.addAssetsToAlbum(
            albumId: albumId,
            uploader: owner,
            candidates: AlbumAssetCandidates(remoteAssetIds: const [], localAssetsToUpload: [source]),
          );

          expect(added, 1);
          verify(
            () => uploadService.uploadManual(
              [source],
              cancelToken: any(named: 'cancelToken'),
              callbacks: any(named: 'callbacks'),
              toLockedAlbum: isLocked,
            ),
          ).called(1);
          verify(
            () => mocks.remoteAlbum.upsertRemoteAssetStub(
              remoteId: 'remote-1',
              ownerId: owner.id,
              source: source,
              visibility: visibility,
            ),
          ).called(1);
          verify(() => mocks.remoteAlbum.addAssets(albumId, ['remote-1'])).called(1);
        });
      }
    });
  });
}
