import 'package:immich_mobile/data/server/partner_locked_asset.dart';
import 'package:immich_mobile/domain/utils/partner_locked_access.dart';

class PartnerLockedAccessService {
  final PartnerLockedAssetApiRepository _apiRepository;

  const PartnerLockedAccessService(this._apiRepository);

  Future<Map<String, Set<String>>> getGrants(Iterable<String> partnerIds) async {
    final entries = await Future.wait(
      partnerIds.map((partnerId) async => MapEntry(partnerId, await _apiRepository.getAssetIds(partnerId))),
    );
    return Map.fromEntries(entries);
  }

  Future<void> apply({
    required Map<String, Set<String>> grants,
    required Map<String, bool> desired,
    required List<String> assetIds,
  }) async {
    for (final MapEntry(key: partnerId, value: shouldShow) in desired.entries) {
      final change = partnerLockedAccessChange(
        granted: grants[partnerId] ?? const {},
        assetIds: assetIds,
        shouldShow: shouldShow,
      );
      if (change.add.isNotEmpty) {
        await _apiRepository.add(partnerId, change.add);
      }
      if (change.remove.isNotEmpty) {
        await _apiRepository.remove(partnerId, change.remove);
      }
    }
  }
}
