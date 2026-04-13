# Group Pricing P0 Design

> Scope: `new-api` current branch only. Environments in scope: `aliyun-test`, `openrouter`.

**Problem**

The pricing group resolution logic can diverge from the user-facing group shown in the admin UI because `users.pricing_group` may retain a stale override value that differs from `users.group`. In `aliyun-test`, this causes `shizeying123` to display as `shizeing3` while billing still resolves to `shizeying2`. The issue is global to pricing resolution and not specific to one model family.

**Business Rule**

- `users.group` is the only effective pricing group.
- If `users.pricing_group` differs from `users.group`, runtime billing must still use `users.group`.
- User create/update flows must keep `pricing_group = group`.
- Historical mismatched rows are not batch-corrected in this change.

**Non-Goals**

- No table schema changes.
- No bulk database cleanup as part of this P0.
- No model-specific pricing redesign in this change.
- No UI redesign beyond what is strictly needed for correctness, unless required by implementation.

## Current Facts

### `openrouter`

- Most users have `pricing_group` as `NULL`, empty, or equal to `group`.
- Effective behavior already mostly matches `group`-driven pricing.

### `aliyun-test`

- `users.id=2` (`shizeying123`) has:
  - `group = shizeing3`
  - `pricing_group = shizeying2`
- `tokens.id=4` is also `group = shizeing3`
- New tasks/logs for this user currently land with `pricing_group = shizeying2`, which proves runtime still prefers the stale override.

## Target Behavior

### Runtime pricing resolution

- Pricing resolution must derive the effective pricing group from `users.group`.
- `pricing_group` may still be carried in API responses or storage for compatibility, but it must not override runtime billing.
- New `tasks.pricing_group` and `logs.pricing_group` must resolve to the effective runtime group, which is now `users.group`.
- Pricing must be decided at submit time and then frozen into task/log snapshots. This P0 must not change long-running task behavior into "settle using the latest user profile at completion time".

### User write flows

- Any user creation or update flow that persists `group` must also persist `pricing_group = group`.
- This guarantees that the next user edit naturally repairs stale rows without requiring a one-time migration.

## Design

### 1. Effective pricing group is derived from `group`

Files likely involved:

- `relay/common/relay_info.go`
- `relay/helper/price.go`
- `middleware/auth.go`
- `model/user_cache.go`

Rules:

- `RelayInfo` should treat the user's effective pricing group as their `group`.
- If compatibility requires carrying `UserPricingGroup`, it must be normalized to `group` before pricing decisions are made.
- Routing group concepts such as auto-group, task routing, or token group should remain unchanged. This fix is only about which group powers pricing lookups.

### 2. User persistence enforces `pricing_group = group`

Files likely involved:

- `controller/user.go`
- `controller/operator.go`
- `model/user.go`
- subscription- or plan-driven user-group mutation paths
- user cache refresh helpers

Rules:

- On create: set both `group` and `pricing_group` to the same value.
- On update: persist `pricing_group = group` regardless of what the client sends.
- Any client-supplied `pricing_group` value must be ignored or overwritten by `group`.
- Any code path that mutates `users.group` must also mutate `users.pricing_group` and refresh user cache consistently.
- No separate pricing-group business semantics remain in write paths for this branch scope.

### 3. No batch historical repair in this change

Why:

- The P0 objective is correctness of runtime pricing.
- Once runtime ignores stale `pricing_group` for new pricing decisions, mismatched rows stop affecting new billing.
- Existing mismatches can be passively corrected on the next edit of each user.
- Existing historical tasks continue to honor their stored pricing snapshots. This fix does not retroactively reprice old tasks.

## Impact

### Expected positive effects

- `gpt-5.1` and any other model for `shizeying123` in `aliyun-test` will resolve pricing from `shizeing3`.
- `tasks.pricing_group` and `logs.pricing_group` for new requests will match `users.group`.
- `default` users should see no behavior change because they already effectively price by `group`.

### Explicitly not solved here

- Model-family-specific pricing issues that are independent of group resolution.
- Any Hailuo SKU vs base-model group-model-ratio inheritance gap, unless it blocks verification after the global fix. Hailuo is a non-blocking smoke target for this P0, not a required pass gate for declaring the global pricing-group fix complete.

## Risks

### Production compatibility

- If any production account intentionally relies on `pricing_group != group`, this change will alter its billing behavior.
- Current `openrouter` data suggests this is rare, but it must be verified by inspection before release.

### Partial fix risk

- If only user write flows are fixed but runtime still reads stale `pricing_group`, the bug will persist until every affected user is edited.
- Therefore runtime resolution change is mandatory for this P0.
- If runtime resolution is changed but not all `group` mutation paths synchronize the compatibility mirror and cache, stale context may continue to appear in downstream requests or admin views.

## Verification

### Functional correctness

For `aliyun-test`, after the fix:

1. `users.id=2` may still physically contain old `pricing_group`, but new runtime behavior must price by `group = shizeing3`.
2. New `tasks` rows for user 2 must have `pricing_group = shizeing3`.
3. New `logs` rows for user 2 must have `pricing_group = shizeing3`.
4. Existing historical tasks must keep their original pricing snapshots and are not repriced.

### Model checks

Use at least:

- `gpt-5.1`
- `MiniMax-Hailuo-2.3-Fast` as a non-blocking smoke target

Success means:

- `gpt-5.1` now resolves group pricing from `shizeing3`.
- No new request for this user continues to land on `shizeying2`.
- Hailuo smoke should show the same corrected pricing-group selection, but Hailuo-specific pricing behavior is not the pass/fail gate for this P0 unless it proves the global fix incomplete.

### Safety checks

- `default` users keep the same observed pricing behavior.
- `openrouter` users whose `pricing_group` is null/empty/equal to `group` remain unchanged in behavior.
- All known `group` mutation paths used in this branch scope preserve `pricing_group = group` after mutation.

## Rollback

If the fix causes unexpected pricing changes for real production accounts:

- Roll back the runtime effective-group resolution change together with any user-write synchronization introduced in this change set.

This keeps rollback behaviorally coherent even though it is not perfectly state-reversible for users already edited after deployment.
