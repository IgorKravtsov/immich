import 'dart:async';

import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:immich_mobile/constants/enums.dart';
import 'package:immich_mobile/domain/models/user.model.dart';
import 'package:immich_mobile/domain/utils/partner_locked_access.dart';
import 'package:immich_mobile/extensions/build_context_extensions.dart';
import 'package:immich_mobile/extensions/theme_extensions.dart';
import 'package:immich_mobile/generated/translations.g.dart';
import 'package:immich_mobile/presentation/actions/action.dart';
import 'package:immich_mobile/presentation/widgets/locked/elevated_session.dart';
import 'package:immich_mobile/presentation/widgets/locked/locked_album_partners.widget.dart';
import 'package:immich_mobile/presentation/widgets/people/partner_user_avatar.widget.dart';
import 'package:immich_mobile/providers/infrastructure/user.provider.dart';
import 'package:immich_mobile/utils/error_handler.dart';
import 'package:immich_mobile/widgets/common/immich_toast.dart';

final _lockedAssetIdsProvider = Provider.family.autoDispose<List<String>, ActionSource>(
  (ref, source) => ref.watch(ownedAssetsActionProvider(source)).locked().map((asset) => asset.id).toList(),
  dependencies: [ownedAssetsActionProvider],
);

class PartnerLockedAccessAction extends AssetActionBuilder {
  const PartnerLockedAccessAction({required super.source});

  @override
  ActionItem? create(BuildContext context, WidgetRef ref) {
    final hasLockedAssets = ref.watch(_lockedAssetIdsProvider(source).select((ids) => ids.isNotEmpty));
    if (!hasLockedAssets) {
      return null;
    }

    return .new(
      icon: Icons.people_alt_outlined,
      label: context.t.locked_show_to_partners,
      onAction: () => _show(context, ref),
    );
  }

  Future<void> _show(BuildContext context, WidgetRef ref) async {
    final assetIds = ref.read(_lockedAssetIdsProvider(source));
    if (assetIds.isEmpty || !await ensureElevatedSession(context, ref) || !context.mounted) {
      return;
    }

    final saved = await showDialog<bool>(
      context: context,
      builder: (_) => PartnerLockedAccessDialog(assetIds: assetIds),
    );
    if (saved == true) {
      ref.read(clearSelectionProvider(source))();
    }
  }
}

class PartnerLockedAccessDialog extends ConsumerStatefulWidget {
  final List<String> assetIds;

  const PartnerLockedAccessDialog({super.key, required this.assetIds});

  @override
  ConsumerState<PartnerLockedAccessDialog> createState() => _PartnerLockedAccessDialogState();
}

class _PartnerLockedAccessDialogState extends ConsumerState<PartnerLockedAccessDialog> {
  Map<String, Set<String>>? _grants;
  final Map<String, bool> _desired = {};
  bool _isLoadStarted = false;
  bool _isSaving = false;

  Future<void> _loadGrants(List<Partner> partners) async {
    try {
      final grants = await ref.read(partnerLockedAccessServiceProvider).getGrants(partners.map((p) => p.id));
      if (mounted) {
        setState(() => _grants = grants);
      }
    } catch (error, stack) {
      handleError(error, stack: stack, description: 'Failed to load partner locked assets');
      if (mounted) {
        Navigator.of(context).pop(false);
      }
    }
  }

  bool? _stateOf(String partnerId) =>
      _desired[partnerId] ?? partnerLockedAccessState(_grants?[partnerId] ?? const {}, widget.assetIds);

  Future<void> _save() async {
    final grants = _grants;
    if (grants == null) {
      return;
    }

    setState(() => _isSaving = true);
    try {
      await ref
          .read(partnerLockedAccessServiceProvider)
          .apply(grants: grants, desired: _desired, assetIds: widget.assetIds);
      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } catch (error, stack) {
      handleError(error, stack: stack, description: 'Failed to update partner locked assets');
      if (mounted) {
        setState(() => _isSaving = false);
        ImmichToast.show(context: context, msg: context.t.locked_show_to_partners_failed, toastType: ToastType.error);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final partnersAsync = ref.watch(sharingPartnersProvider);
    final partners = partnersAsync.valueOrNull;
    if (partners != null && !_isLoadStarted) {
      _isLoadStarted = true;
      unawaited(Future.microtask(() => _loadGrants(partners)));
    }

    final isLoading = partners == null || _grants == null;

    return AlertDialog(
      title: Text(context.t.locked_show_to_partners),
      content: SizedBox(
        width: double.maxFinite,
        child: isLoading
            ? const SizedBox(height: 96, child: Center(child: CircularProgressIndicator()))
            : ListView(
                shrinkWrap: true,
                children: [
                  Text(
                    partners.isEmpty ? context.t.locked_no_partners : context.t.locked_show_to_partners_description,
                    style: context.textTheme.labelLarge?.copyWith(color: context.colorScheme.onSurfaceSecondary),
                  ),
                  for (final partner in partners)
                    CheckboxListTile(
                      tristate: _stateOf(partner.id) == null,
                      value: _stateOf(partner.id),
                      onChanged: _isSaving
                          ? null
                          : (_) => setState(() => _desired[partner.id] = _stateOf(partner.id) != true),
                      secondary: PartnerUserAvatar(userId: partner.id, name: partner.name),
                      title: Text(partner.name),
                    ),
                ],
              ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(false), child: Text(context.t.cancel)),
        FilledButton(onPressed: isLoading || _isSaving || _desired.isEmpty ? null : _save, child: Text(context.t.save)),
      ],
    );
  }
}
