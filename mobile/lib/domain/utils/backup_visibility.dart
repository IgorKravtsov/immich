import 'package:immich_mobile/domain/models/asset/base_asset.model.dart';

AssetVisibility? backupUploadVisibility({required bool isLivePhotoMotion, required bool isInLockedAlbum}) {
  if (isLivePhotoMotion) {
    return AssetVisibility.hidden;
  }

  return isInLockedAlbum ? AssetVisibility.locked : null;
}
