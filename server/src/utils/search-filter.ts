import { AuthDto } from 'src/dtos/auth.dto.js';
import { SearchFilter, SearchFilterBranch } from 'src/dtos/search.dto.js';
import { AssetVisibility } from 'src/enum.js';
import { requireElevatedPermission } from 'src/utils/access.js';

type EnumField = 'type' | 'visibility';
type EnumOperator = keyof NonNullable<SearchFilterBranch[EnumField]>;
type EnumOperandMap<T> = { eq: T; ne: T; in: T[]; notIn: T[] };
type EnumCondition<T> = { [K in EnumOperator]?: EnumOperandMap<T>[K] };
type IdsFilterField = 'albumIds' | 'personIds' | 'tagIds';

const filterBranches = (filter: SearchFilter): SearchFilterBranch[] => [filter, ...(filter.or ?? [])];

/** Whether a row with `value` can satisfy the condition. A missing operator allows any value. */
const canMatch = <T>(condition: EnumCondition<T>, value: T): boolean => {
  const { eq, ne, in: anyOf, notIn, ...unhandled } = condition;
  // fails to compile when EnumFilter gains an operator this check does not consider
  void (unhandled satisfies Record<string, never>);

  return (
    (eq === undefined || eq === value) &&
    (ne === undefined || ne !== value) &&
    (anyOf === undefined || anyOf.includes(value)) &&
    (notIn === undefined || !notIn.includes(value))
  );
};

/** The conditions that decide which `field` values the filter can return. A top-level condition decides alone, otherwise each branch itself. */
const decidingConditions = <F extends EnumField>(filter: SearchFilter, field: F) => {
  if (filter[field] !== undefined) {
    return [filter[field]];
  }

  return filterBranches(filter)
    .map((branch) => branch[field])
    .filter((condition) => condition !== undefined);
};

/**
Keeps locked assets out of search results unless the session is elevated: a filter that asks for
them is rejected with 401, and any other filter gets `visibility != locked` ANDed in.
*/
export const applyLockedVisibilityPolicy = (auth: AuthDto, filter: SearchFilter): SearchFilter => {
  if (auth.session?.hasElevatedPermission) {
    return filter;
  }

  if (decidingConditions(filter, 'visibility').some((condition) => canMatch(condition, AssetVisibility.Locked))) {
    requireElevatedPermission(auth);
  }

  if (filter.visibility !== undefined) {
    return filter;
  }

  return { ...filter, visibility: { ne: AssetVisibility.Locked } };
};

const trashedAtExcludesTrashed = (condition: NonNullable<SearchFilterBranch['trashedAt']>) => condition.eq === null;

/**
Keeps trashed assets out of search results unless the session is elevated: a filter that can match
them is rejected with 401, and a filter without a trash condition gets `trashedAt = null` ANDed in.
*/
export const applyTrashedVisibilityPolicy = (auth: AuthDto, filter: SearchFilter): SearchFilter => {
  if (auth.session?.hasElevatedPermission) {
    return filter;
  }

  const conditions =
    filter.trashedAt === undefined ? filterBranches(filter).map((branch) => branch.trashedAt) : [filter.trashedAt];
  const asksForTrash = conditions.some((condition) => condition !== undefined && !trashedAtExcludesTrashed(condition));
  if (asksForTrash) {
    requireElevatedPermission(auth);
  }

  if (filter.trashedAt !== undefined) {
    return filter;
  }

  return { ...filter, trashedAt: { eq: null } };
};

type LegacyTrashOptions = { withDeleted?: boolean; trashedBefore?: Date; trashedAfter?: Date; isOffline?: boolean };

export const requireElevatedPermissionForTrash = (auth: AuthDto, options: LegacyTrashOptions) => {
  if (options.withDeleted || options.trashedBefore || options.trashedAfter || options.isOffline) {
    requireElevatedPermission(auth);
  }
};

export const collectFilterIds = (filter: SearchFilter, field: IdsFilterField): string[] => {
  const ids = new Set<string>();

  for (const branch of filterBranches(filter)) {
    for (const operator of ['any', 'all', 'none'] as const) {
      for (const id of branch[field]?.[operator] ?? []) {
        ids.add(id);
      }
    }
  }

  return [...ids];
};
