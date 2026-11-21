import 'dart:async';

import 'package:auto_route/auto_route.dart';
import 'package:flutter/widgets.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:immich_mobile/providers/auth.provider.dart';
import 'package:immich_mobile/routing/router.dart';

class LockedSessionScope extends ConsumerStatefulWidget {
  final Widget child;
  final bool lockOnPop;

  const LockedSessionScope({super.key, required this.child, this.lockOnPop = false});

  @override
  ConsumerState<LockedSessionScope> createState() => _LockedSessionScopeState();
}

class _LockedSessionScopeState extends ConsumerState<LockedSessionScope> with WidgetsBindingObserver {
  bool _showOverlay = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!mounted) {
      return;
    }
    if (state == AppLifecycleState.paused) {
      unawaited(ref.read(authProvider.notifier).lockPinCode());
      unawaited(context.navigateTo(const TabShellRoute()));
      return;
    }
    setState(() {
      _showOverlay = state != AppLifecycleState.resumed;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_showOverlay) {
      return const SizedBox();
    }

    if (!widget.lockOnPop) {
      return widget.child;
    }

    return PopScope(
      onPopInvokedWithResult: (didPop, _) => didPop ? ref.read(authProvider.notifier).lockPinCode() : null,
      child: widget.child,
    );
  }
}
