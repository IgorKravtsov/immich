bool? partnerLockedAccessState(Set<String> granted, Iterable<String> assetIds) {
  final ids = assetIds.toSet();
  if (ids.isEmpty) {
    return false;
  }

  final grantedCount = ids.where(granted.contains).length;
  if (grantedCount == ids.length) {
    return true;
  }

  return grantedCount == 0 ? false : null;
}

typedef PartnerLockedAccessChange = ({List<String> add, List<String> remove});

PartnerLockedAccessChange partnerLockedAccessChange({
  required Set<String> granted,
  required Iterable<String> assetIds,
  required bool shouldShow,
}) {
  final ids = assetIds.toSet();
  if (shouldShow) {
    return (add: ids.where((id) => !granted.contains(id)).toList(), remove: const []);
  }

  return (add: const [], remove: ids.where(granted.contains).toList());
}
