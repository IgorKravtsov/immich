import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:immich_mobile/constants/constants.dart';
import 'package:immich_mobile/generated/translations.g.dart';
import 'package:immich_mobile/providers/api.provider.dart';
import 'package:immich_mobile/providers/auth.provider.dart';
import 'package:immich_mobile/services/local_auth.service.dart';
import 'package:immich_mobile/services/secure_storage.service.dart';
import 'package:immich_mobile/widgets/common/immich_toast.dart';
import 'package:immich_mobile/widgets/forms/pin_verification_form.dart';
import 'package:logging/logging.dart';

final _log = Logger('ElevatedSession');

Future<bool> ensureElevatedSession(BuildContext context, WidgetRef ref, {bool alwaysVerify = false}) async {
  final status = await ref.read(apiServiceProvider).authenticationApi.getAuthStatus();
  if (status == null || !context.mounted) {
    return false;
  }

  if (!status.pinCode) {
    ImmichToast.show(context: context, msg: context.t.locked_pin_code_setup_required, toastType: ToastType.error);
    return false;
  }

  if (status.isElevated && !alwaysVerify) {
    return true;
  }

  if (await _unlockWithBiometrics(ref)) {
    return true;
  }

  if (!context.mounted) {
    return false;
  }

  final unlocked = await showDialog<bool>(context: context, builder: (_) => const _PinDialog());
  return unlocked ?? false;
}

Future<bool> _unlockWithBiometrics(WidgetRef ref) async {
  final secureStorage = ref.read(secureStorageServiceProvider);
  final pinCode = await secureStorage.read(kSecuredPinCode);
  if (pinCode == null) {
    return false;
  }

  try {
    if (!await ref.read(localAuthServiceProvider).authenticate()) {
      return false;
    }

    if (await ref.read(authProvider.notifier).unlockPinCode(pinCode)) {
      return true;
    }

    await secureStorage.delete(kSecuredPinCode);
    return false;
  } catch (error, stack) {
    _log.warning('Biometric unlock failed', error, stack);
    return false;
  }
}

class _PinDialog extends StatelessWidget {
  const _PinDialog();

  @override
  Widget build(BuildContext context) {
    return SimpleDialog(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: PinVerificationForm(
            autoFocus: true,
            description: context.t.locked_pin_code_required,
            onSuccess: (_) => Navigator.of(context).pop(true),
          ),
        ),
      ],
    );
  }
}
