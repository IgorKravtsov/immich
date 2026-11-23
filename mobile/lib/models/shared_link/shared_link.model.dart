import 'package:flutter/foundation.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:openapi/api.dart';

part 'shared_link.model.freezed.dart';

enum SharedLinkSource { album, individual }

@freezed
abstract class SharedLink with _$SharedLink {
  const factory SharedLink({
    required String id,
    required String title,
    required bool allowDownload,
    required bool allowUpload,
    required String? thumbAssetId,
    required String? description,
    required String? password,
    required DateTime? expiresAt,
    required String key,
    required bool showMetadata,
    required SharedLinkSource type,
    required String? slug,
    @Default(false) bool isLocked,
  }) = _SharedLink;

  factory SharedLink.fromDto(SharedLinkResponseDto dto) {
    final isAlbum = dto.type == SharedLinkType.ALBUM;
    final album = isAlbum ? dto.album.orElse(null) : null;
    return SharedLink(
      id: dto.id,
      allowDownload: dto.allowDownload,
      allowUpload: dto.allowUpload,
      description: dto.description,
      password: dto.password,
      expiresAt: dto.expiresAt,
      key: dto.key,
      showMetadata: dto.showMetadata,
      slug: dto.slug,
      type: isAlbum ? SharedLinkSource.album : SharedLinkSource.individual,
      title: isAlbum ? album?.albumName.toUpperCase() ?? "UNKNOWN SHARE" : "INDIVIDUAL SHARE",
      isLocked: album?.isLocked ?? false,
      thumbAssetId: isAlbum
          ? album?.albumThumbnailAssetId
          : dto.assets.isNotEmpty
          ? dto.assets[0].id
          : null,
    );
  }
}
