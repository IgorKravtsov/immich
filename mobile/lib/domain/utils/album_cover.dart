import 'package:immich_mobile/domain/models/album/album.model.dart';
import 'package:immich_mobile/domain/models/asset/base_asset.model.dart';

RemoteAsset? visibleAlbumCover(RemoteAlbum album, RemoteAsset? cover) {
  if (cover == null) {
    return null;
  }

  return album.isLocked || cover.visibility != AssetVisibility.locked ? cover : null;
}
