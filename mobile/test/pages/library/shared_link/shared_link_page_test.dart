import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:immich_mobile/models/shared_link/shared_link.model.dart';
import 'package:immich_mobile/pages/library/shared_link/shared_link.page.dart';
import 'package:immich_mobile/providers/auth.provider.dart';
import 'package:immich_mobile/providers/shared_link.provider.dart';
import 'package:immich_mobile/services/shared_link.service.dart';
import 'package:mocktail/mocktail.dart';

import '../../../service.mocks.dart';
import '../../../widget_tester_extensions.dart';

class _MockSharedLinkService extends Mock implements SharedLinkService {}

class _TestAuthNotifier extends AuthNotifier {
  _TestAuthNotifier(Ref ref, this.onLock)
    : super(
        MockAuthService(),
        MockApiService(),
        MockUserService(),
        MockSecureStorageService(),
        MockWidgetService(),
        ref,
      );

  final void Function() onLock;

  @override
  Future<void> lockPinCode() async => onLock();
}

const _link = SharedLink(
  id: 'link-id',
  title: 'SECRET',
  allowDownload: true,
  allowUpload: false,
  thumbAssetId: null,
  description: null,
  password: 'secret',
  expiresAt: null,
  key: 'key',
  showMetadata: true,
  type: SharedLinkSource.album,
  slug: null,
  isLocked: true,
);

const _lockButton = ValueKey('shared-links-lock');

void main() {
  late _MockSharedLinkService sharedLinkService;
  late bool isElevated;

  setUp(() {
    sharedLinkService = _MockSharedLinkService();
    isElevated = true;
  });

  Future<void> pumpPage(WidgetTester tester, List<SharedLink> links) async {
    when(() => sharedLinkService.getAllSharedLinks()).thenAnswer((_) async => AsyncData(links));
    await tester.pumpConsumerWidget(
      const SharedLinkPage(),
      overrides: [
        sharedLinksStateProvider.overrideWith((ref) => SharedLinksNotifier(sharedLinkService)),
        sharedLinksSessionElevatedProvider.overrideWith((ref) async => isElevated),
        authProvider.overrideWith((ref) => _TestAuthNotifier(ref, () => isElevated = false)),
      ],
    );
    await tester.pumpAndSettle();
  }

  group('SharedLinkPage', () {
    testWidgets('locks the session from the app bar and hides the locked album again', (tester) async {
      await pumpPage(tester, [_link]);

      expect(find.byKey(const ValueKey('shared-link-locked-cover')), findsNothing);

      await tester.tap(find.byKey(_lockButton));
      await tester.pumpAndSettle();

      expect(isElevated, isFalse);
      expect(find.byKey(const ValueKey('shared-link-locked-cover')), findsOneWidget);
      expect(find.byKey(_lockButton), findsNothing);
    });

    testWidgets('does not show the lock button without locked album links', (tester) async {
      await pumpPage(tester, [_link.copyWith(isLocked: false)]);

      expect(find.byKey(_lockButton), findsNothing);
    });

    testWidgets('does not show the lock button while the session is locked', (tester) async {
      isElevated = false;
      await pumpPage(tester, [_link]);

      expect(find.byKey(_lockButton), findsNothing);
    });
  });
}
