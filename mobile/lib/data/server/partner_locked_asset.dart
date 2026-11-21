import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:immich_mobile/data/server/api_repository.dart';
import 'package:immich_mobile/providers/api.provider.dart';
import 'package:openapi/api.dart';

final partnerLockedAssetApiRepositoryProvider = Provider(
  (ref) => PartnerLockedAssetApiRepository(ref.watch(apiServiceProvider).partnersApi),
);

class PartnerLockedAssetApiRepository extends ApiRepository {
  final PartnersApi _api;

  const PartnerLockedAssetApiRepository(this._api);

  Future<Set<String>> getAssetIds(String partnerId) async {
    final response = await checkNull(_api.getPartnerLockedAssets(partnerId));
    return response.assetIds.toSet();
  }

  Future<void> add(String partnerId, List<String> assetIds) =>
      _api.addPartnerLockedAssets(partnerId, PartnerLockedAssetsDto(assetIds: assetIds));

  Future<void> remove(String partnerId, List<String> assetIds) =>
      _api.removePartnerLockedAssets(partnerId, PartnerLockedAssetsDto(assetIds: assetIds));
}
