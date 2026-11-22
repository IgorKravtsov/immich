import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:immich_mobile/constants/enums.dart';
import 'package:immich_mobile/domain/models/album/album.model.dart';
import 'package:immich_mobile/generated/translations.g.dart';
import 'package:immich_mobile/presentation/actions/action.widget.dart';
import 'package:immich_mobile/presentation/actions/asset_debug.action.dart';
import 'package:immich_mobile/presentation/actions/delete.action.dart';
import 'package:immich_mobile/presentation/actions/download.action.dart';
import 'package:immich_mobile/presentation/actions/lock.action.dart';
import 'package:immich_mobile/presentation/actions/partner_locked_access.action.dart';
import 'package:immich_mobile/presentation/actions/share.action.dart';
import 'package:immich_mobile/presentation/widgets/album/album_selector.widget.dart';
import 'package:immich_mobile/presentation/widgets/bottom_sheet/base_bottom_sheet.widget.dart';
import 'package:immich_mobile/providers/infrastructure/action.provider.dart';
import 'package:immich_mobile/widgets/common/immich_toast.dart';

class LockedFolderBottomSheet extends ConsumerStatefulWidget {
  const LockedFolderBottomSheet({super.key});

  @override
  ConsumerState<LockedFolderBottomSheet> createState() => _LockedFolderBottomSheetState();
}

class _LockedFolderBottomSheetState extends ConsumerState<LockedFolderBottomSheet> {
  final sheetController = DraggableScrollableController();

  @override
  void dispose() {
    sheetController.dispose();
    super.dispose();
  }

  Future<void> addToAlbum(RemoteAlbum album) async {
    final result = await ref.read(actionProvider.notifier).addToAlbum(ActionSource.timeline, album);

    if (!mounted) {
      return;
    }

    if (!result.success) {
      ImmichToast.show(context: context, msg: context.t.scaffold_body_error_occurred, toastType: ToastType.error);
      return;
    }

    if (result.count == 0 && result.failedCount > 0) {
      ImmichToast.show(
        context: context,
        msg: context.t.assets_cannot_be_added_to_album_count(count: result.failedCount),
        toastType: ToastType.error,
      );
      return;
    }

    ImmichToast.show(
      context: context,
      msg: result.count == 0
          ? context.t.add_to_album_bottom_sheet_already_exists(album: album.name)
          : context.t.add_to_album_bottom_sheet_added(album: album.name),
    );
  }

  Future<void> onKeyboardExpand() {
    return sheetController.animateTo(0.85, duration: const Duration(milliseconds: 200), curve: Curves.easeInOut);
  }

  @override
  Widget build(BuildContext context) {
    return BaseBottomSheet(
      controller: sheetController,
      initialChildSize: 0.25,
      maxChildSize: 0.85,
      shouldCloseOnMinExtent: false,
      actions: const <ActionColumnButton>[
        .new(action: AssetDebugAction(source: .timeline)),
        .new(action: ShareAction(source: .timeline)),
        .new(action: DownloadAction(source: .timeline)),
        .new(action: DeleteAction(source: .timeline)),
        .new(action: LockAction(source: .timeline)),
        .new(action: PartnerLockedAccessAction(source: .timeline)),
      ],
      slivers: [
        const AddToAlbumHeader(showCreateAlbum: false),
        AlbumSelector(onAlbumSelected: addToAlbum, onKeyboardExpanded: onKeyboardExpand, lockedOnly: true),
      ],
    );
  }
}
