import 'package:flutter_test/flutter_test.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:immich_mobile/models/server_info/server_version.model.dart';
import 'package:immich_mobile/providers/infrastructure/remote_album.provider.dart';
import 'package:immich_mobile/providers/server_info.provider.dart';

import '../../riverpod_mocks.dart';
import '../../service.mocks.dart';

void main() {
  bool supportedOn(ServerVersion version) {
    final container = ProviderContainer(
      overrides: [
        serverInfoProvider.overrideWith((ref) => StubServerInfoNotifier(MockServerInfoService(), version: version)),
      ],
    );
    addTearDown(container.dispose);
    return container.read(lockedAlbumsSupportedProvider);
  }

  test('is unavailable on a server older than the locked albums release', () {
    expect(supportedOn(const ServerVersion(major: 3, minor: 3, patch: 9)), isFalse);
  });

  test('is available from the locked albums release candidate', () {
    expect(supportedOn(const ServerVersion(major: 3, minor: 4, patch: 0, prerelease: 0)), isTrue);
  });

  test('is available on a later release', () {
    expect(supportedOn(const ServerVersion(major: 3, minor: 5, patch: 0)), isTrue);
  });
}
