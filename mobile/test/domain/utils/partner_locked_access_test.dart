import 'package:flutter_test/flutter_test.dart';
import 'package:immich_mobile/domain/utils/partner_locked_access.dart';

void main() {
  group('partnerLockedAccessState', () {
    test('is true when every selected asset is shared', () {
      expect(partnerLockedAccessState({'a', 'b', 'c'}, ['a', 'b']), isTrue);
    });

    test('is false when no selected asset is shared', () {
      expect(partnerLockedAccessState({'c'}, ['a', 'b']), isFalse);
    });

    test('is null when only some selected assets are shared', () {
      expect(partnerLockedAccessState({'a'}, ['a', 'b']), isNull);
    });

    test('is false for an empty selection', () {
      expect(partnerLockedAccessState({'a'}, const []), isFalse);
    });
  });

  group('partnerLockedAccessChange', () {
    test('adds only the assets that are not shared yet', () {
      final change = partnerLockedAccessChange(granted: {'a'}, assetIds: ['a', 'b'], shouldShow: true);

      expect(change.add, ['b']);
      expect(change.remove, isEmpty);
    });

    test('removes only the assets that are shared', () {
      final change = partnerLockedAccessChange(granted: {'a', 'c'}, assetIds: ['a', 'b'], shouldShow: false);

      expect(change.add, isEmpty);
      expect(change.remove, ['a']);
    });
  });
}
