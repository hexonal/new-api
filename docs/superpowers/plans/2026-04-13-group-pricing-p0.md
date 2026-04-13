# Group Pricing P0 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `users.group` the only effective pricing group for new runtime pricing decisions, while keeping `pricing_group` as a compatibility mirror that is always synchronized to `group` on writes.

**Architecture:** Fix the problem at two seams only: runtime pricing-group resolution and user/group write paths. Preserve submit-time pricing snapshots for tasks, do not reprice historical tasks, and do not introduce model-specific behavior as part of this P0.

**Tech Stack:** Go, Gin, GORM, PostgreSQL, Redis cache, React admin UI (read-only impact verification only)

---

## File Map

### Runtime pricing resolution

- Modify: `relay/common/relay_info.go`
  - Normalize effective pricing group to `UsingGroup` / user `group`
- Modify: `relay/helper/price.go`
  - Remove runtime preference for stale `UserPricingGroup`
- Modify: `service/task_billing.go`
  - Ensure fallback pricing-group resolution for token recalculation / settlement uses task snapshot first, then task/user `group`, not stale user `pricing_group`
- Modify: `model/task.go`
  - Keep task snapshot semantics explicit; `GetPricingGroup()` should reflect new runtime meaning for new tasks while preserving old tasks

### User write paths

- Modify: `controller/user.go`
  - All admin user updates force `pricing_group = group`
- Modify: `controller/operator.go`
  - Operator/provision entry forces `pricing_group = group`
- Modify: `model/user.go`
  - Persistence helpers mirror `pricing_group = group`
- Modify: `model/user_cache.go`
  - Cache writes/reads mirror `pricing_group` from `group`
- Modify: `model/subscription.go`
  - Any plan/upgrade/downgrade path that mutates `users.group` also mutates `pricing_group`

### Tests

- Modify/Create: `relay/helper/price_test.go`
- Modify/Create: `service/task_billing_test.go`
- Modify/Create: `model/user_test.go` or nearest existing user persistence test file
- Modify/Create: `controller/user_test.go` if controller tests exist; otherwise add focused model/service tests instead

### Verification artifacts

- Read only: `docs/superpowers/specs/2026-04-13-group-pricing-p0-design.md`

---

### Task 1: Audit Runtime Pricing-Group Entry Points

**Files:**
- Modify: `relay/common/relay_info.go`
- Modify: `relay/helper/price.go`
- Modify: `service/task_billing.go`
- Test: `relay/helper/price_test.go`
- Test: `service/task_billing_test.go`

- [ ] **Step 1: Write failing tests for runtime pricing-group normalization**

Add tests that prove:
- when `user.group = shizeing3` and `user.pricing_group = shizeying2`, new pricing resolution uses `shizeing3`
- historical task snapshots still keep their frozen pricing group

- [ ] **Step 2: Run targeted tests to verify they fail**

Run:
```bash
go test ./relay/helper ./service -run 'Test(.*PricingGroup|.*GroupRatio)'
```

Expected:
- at least one new test fails because runtime still prefers `pricing_group`

- [ ] **Step 3: Implement minimal runtime normalization**

Change code so that:
- runtime effective pricing group for new requests resolves from `group`
- stale `pricing_group` no longer overrides new pricing
- settlement/recalculation still honors task snapshot first

- [ ] **Step 4: Re-run targeted tests**

Run:
```bash
go test ./relay/helper ./service -run 'Test(.*PricingGroup|.*GroupRatio)'
```

Expected:
- all targeted tests pass

- [ ] **Step 5: Commit runtime pricing-group seam fix**

```bash
git add relay/common/relay_info.go relay/helper/price.go service/task_billing.go relay/helper/price_test.go service/task_billing_test.go
git commit -m "fix: normalize runtime pricing group to user group"
```

---

### Task 2: Close User Write Paths

**Files:**
- Modify: `controller/user.go`
- Modify: `controller/operator.go`
- Modify: `model/user.go`
- Modify: `model/user_cache.go`
- Test: nearest existing user/controller tests or new focused tests

- [ ] **Step 1: Write failing tests for user write-path mirroring**

Cover:
- admin update with mismatched incoming `pricing_group` still persists `pricing_group = group`
- operator/provision create/update also persists the mirrored value
- cache refresh reflects mirrored `pricing_group`

- [ ] **Step 2: Run targeted tests to verify they fail**

Run:
```bash
go test ./controller ./model -run 'Test(.*PricingGroup|.*UserGroup)'
```

Expected:
- at least one new test fails because write paths still accept/keep divergent values

- [ ] **Step 3: Implement write-path synchronization**

Change code so that:
- any create/update path setting `group` also sets `pricing_group = group`
- client-supplied `pricing_group` is ignored or overwritten
- cache writes stay consistent with persisted user data

- [ ] **Step 4: Re-run targeted tests**

Run:
```bash
go test ./controller ./model -run 'Test(.*PricingGroup|.*UserGroup)'
```

Expected:
- all targeted tests pass

- [ ] **Step 5: Commit user write-path sync fix**

```bash
git add controller/user.go controller/operator.go model/user.go model/user_cache.go
git commit -m "fix: mirror pricing group to user group on writes"
```

---

### Task 3: Cover Subscription / Plan Mutation Paths

**Files:**
- Modify: `model/subscription.go`
- Modify: `model/user_cache.go` if needed
- Test: nearest subscription test file or new focused tests

- [ ] **Step 1: Write failing tests for subscription-driven group mutation**

Cover:
- when a subscription or plan flow updates `users.group`, the persisted `pricing_group` is also updated
- cache mirrors the new group immediately

- [ ] **Step 2: Run targeted tests to verify they fail**

Run:
```bash
go test ./model -run 'Test(.*Subscription.*Group|.*Plan.*Group)'
```

Expected:
- at least one new test fails because subscription paths only update `group`

- [ ] **Step 3: Implement minimal synchronization in subscription paths**

Update only the specific mutation points that persist `users.group`.

- [ ] **Step 4: Re-run targeted tests**

Run:
```bash
go test ./model -run 'Test(.*Subscription.*Group|.*Plan.*Group)'
```

Expected:
- all targeted tests pass

- [ ] **Step 5: Commit subscription-path sync fix**

```bash
git add model/subscription.go model/user_cache.go
git commit -m "fix: sync pricing group in subscription group updates"
```

---

### Task 4: Global Reference Scan and Safety Verification

**Files:**
- Search only; patch only if a direct runtime `UserPricingGroup` priority path remains

- [ ] **Step 1: Search for remaining direct `UserPricingGroup` priority reads**

Run:
```bash
rg -n "UserPricingGroup|pricing_group" relay service middleware controller model
```

Expected:
- identify any remaining runtime path that still gives stale `pricing_group` precedence

- [ ] **Step 2: Patch any remaining runtime precedence seam**

Only patch if the scan finds another active runtime pricing decision point not already covered in Tasks 1-3.

- [ ] **Step 3: Re-run focused regression suite**

Run:
```bash
go test ./relay ./service ./model ./controller
```

Expected:
- no regression in touched packages

- [ ] **Step 4: Commit final cleanup**

```bash
git add -A
git commit -m "test: close remaining pricing group precedence paths"
```

---

### Task 5: Environment Audit and Fail-Closed Verification

**Files:**
- No code changes required unless verification exposes a missed seam

- [ ] **Step 1: Audit `openrouter` production-risk accounts**

Using MCP only, produce a list of users where:
- `pricing_group` is non-empty
- and differs from `group`

Expected:
- explicit review artifact before release

- [ ] **Step 2: Verify `aliyun-test` user/group behavior**

Using MCP only, check before/after for user 2:
- `users.group`
- `users.pricing_group`
- new `tasks.pricing_group`
- new `logs.pricing_group`

Expected:
- new tasks/logs resolve to `shizeing3`

- [ ] **Step 3: Run model verification requests**

Verify at least:
- `gpt-5.1` (required gate)
- `MiniMax-Hailuo-2.3-Fast` (non-blocking smoke)

Expected:
- `gpt-5.1` proves new requests no longer land on `shizeying2`
- Hailuo smoke confirms corrected group selection even if model-specific pricing remains out of scope

- [ ] **Step 4: Record failure policy**

Fail immediately if:
- any new task/log for user 2 still lands on `pricing_group = shizeying2`
- any production audit account appears intentionally configured for divergent pricing and lacks explicit approval

- [ ] **Step 5: Commit verification notes only if they are stored in repo**

```bash
git status --short
```

Expected:
- no accidental debug files committed

---

## Final Verification

- [ ] Run full touched-package regression:

```bash
go test ./relay ./service ./model ./controller
```

- [ ] Run frontend build only if any admin UI/runtime contract file changed:

```bash
npm run build
```

- [ ] Confirm no new request in `aliyun-test` for user 2 lands on `pricing_group = shizeying2`

- [ ] Confirm `openrouter` audit list is reviewed before release

---

## Notes

- This plan intentionally does **not** batch-fix historical DB rows.
- This plan intentionally does **not** include Hailuo SKU/base-model pricing redesign.
- Historical tasks keep their original pricing snapshots; this is a correctness constraint, not technical debt for this P0.
