import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:immich_mobile/models/shared_link/shared_link.model.dart';
import 'package:immich_mobile/providers/shared_link.provider.dart';
import 'package:immich_mobile/widgets/shared_link/shared_link_item.dart';

import '../../widget_tester_extensions.dart';

const _lockedLink = SharedLink(
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

void main() {
  group('SharedLinkItem', () {
    testWidgets('shows a lock and an unlock button for a locked album without an elevated session', (tester) async {
      await tester.pumpConsumerWidget(
        const SharedLinkItem(_lockedLink),
        overrides: [sharedLinksSessionElevatedProvider.overrideWith((ref) async => false)],
      );

      expect(find.byKey(const ValueKey('shared-link-locked-cover')), findsOneWidget);
      expect(find.byIcon(Icons.lock_open_outlined), findsOneWidget);
      expect(find.text('SECRET'), findsOneWidget);
    });

    testWidgets('shows the link normally once the session is elevated', (tester) async {
      await tester.pumpConsumerWidget(
        const SharedLinkItem(_lockedLink),
        overrides: [sharedLinksSessionElevatedProvider.overrideWith((ref) async => true)],
      );

      expect(find.byKey(const ValueKey('shared-link-locked-cover')), findsNothing);
      expect(find.byIcon(Icons.lock_open_outlined), findsNothing);
    });

    testWidgets('does not lock a regular album link', (tester) async {
      await tester.pumpConsumerWidget(
        SharedLinkItem(_lockedLink.copyWith(isLocked: false)),
        overrides: [sharedLinksSessionElevatedProvider.overrideWith((ref) async => false)],
      );

      expect(find.byKey(const ValueKey('shared-link-locked-cover')), findsNothing);
      expect(find.byIcon(Icons.lock_open_outlined), findsNothing);
    });
  });
}
