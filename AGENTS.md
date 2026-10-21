# All-In-One V2 API Rules

## Branching: Continuous Staging and On-Demand Main Synchronization

> This section takes precedence over any other branch or pull-request-target instruction in this file.
> `main` is this repository's production branch.

The development workflow is continuous and is not restricted to a daily schedule, a single task, or a fixed number of tasks.

- Before beginning a new development cycle, inspect the relationship between `main` and `staging` and synchronize them when necessary.
- All task branches must originate from the latest `staging`.
- Completed tasks must be submitted through PRs targeting `staging`.
- Developers and agents may continue starting and completing additional tasks for as long as needed.
- Do not synchronize `staging` into `main` automatically after each task, after a fixed time interval, or simply because the day has ended.
- Synchronize `staging` into `main` only when the team explicitly decides that the accumulated changes are ready for delivery.
- Before synchronization, validate the combined changes and complete all required reviews and checks.
- Never merge unfinished or known-broken changes into `main`.
- After synchronization, verify the resulting branch state before continuing.
- **When a task is done, ask the repository owner / team lead whether it is all good.** They decide whether it merges and when `staging` is synchronized; an agent's or author's own judgment is not approval.
- **Check deploy triggers before merging into `staging`:** some repos deploy on pushes to `staging` (see `.github/workflows/`). Merging is a deployment decision, not just a code review.
- **Project board:** move the item through the product's GitHub Project — Backlog → To-Do → In progress → Done.

**Workflow:** Establish baseline → Develop tasks → Merge completed tasks into staging → Continue working or synchronize to main when ready → Repeat.

`staging` is the continuous integration branch. `main` is updated on demand when the team chooses to deliver the accumulated changes.

```bash
# Start a task
git fetch origin
git log --oneline origin/main..origin/staging   # what staging has that main doesn't
git checkout staging && git pull
git checkout -b <type>/<short-description>      # feat/, fix/, docs/, test/, chore/ ...

# Finish a task: open a PR into staging (never into main)
gh pr create --base staging

# Deliver (only when the owner decides): one PR from staging into main
gh pr create --base main --head staging
```

---

## 1. Git Branching and Work Safety

### Inspect Before Editing

- Before making any changes, inspect `git status`, the current branch, and `git diff`.
- Check for uncommitted changes and verify whether they belong to the current task.
- Never discard, reset, clean, stash, or commit existing work without explicit authorization.

### Dedicated Branches Are Mandatory

- Before implementing a new feature, bug fix, refactor, optimization, or other code change, create or switch to a dedicated task branch.
- Never develop directly on `main`, `master`, or `staging`.
- Use descriptive branch names:
  - `feat/<short-description>` — new features
  - `fix/<short-description>` — bug fixes
  - `perf/<short-description>` — performance improvements
  - `refactor/<short-description>` — refactoring
  - `docs/<short-description>` — documentation
  - `test/<short-description>` — tests
  - `chore/<short-description>` — maintenance and tooling
- If a change spans multiple services, use the matching branch name across repositories.

### Preserve Existing Work

- If the current branch contains unrelated uncommitted changes, do not automatically commit, stash, or move them.
- If existing changes overlap with the task or ownership is unclear, stop and ask for clarification before editing.
- Before switching branches, check whether uncommitted changes could carry into another branch.

### Completion & Branch Preservation

- Report the branch used in the task completion summary.
- Do not merge into protected or shared branches, push changes, or open a pull request unless explicitly requested or authorized.
- **Never delete branches (local or remote)**: Do not delete any branch (`git branch -d`, `git branch -D`, or `git push --delete`), even after a merge or pull request is completed, unless explicitly instructed by the user.

---

## 2. Architecture & Layer Boundaries

This repository enforces a modular, clean layer structure under `src/modules/`:

- **Repositories (`*.repository.ts`)**: Direct database and Prisma access only. Never import controllers or routes.
- **Services (`*.service.ts`)**: Domain and business logic, transactional coordination. Never import controllers or routes.
- **Controllers (`*.controller.ts`)**: HTTP request handling, DTO validation, and response formatting. Never run direct Prisma queries.
- **Routes (`*.route.ts`)**: Express routing, parameter parsing, middleware binding, and RBAC / permission guards.
- **Suppliers & Adapters (`src/suppliers/`)**: External supplier integrations (e.g., CJ Dropshipping, Printful). Follow the adapter pattern (`supplier.interface.ts`).

---

## 3. Background Workers & Consumers

- Asynchronous jobs and event listeners run via SQS/worker processes (`src/worker.ts` and `src/consumers/`).
- Do not perform heavy external supplier synchronization or long-running tasks synchronously in HTTP route handlers. Dispatch to queues instead.

---

## 4. Database & Prisma Guardrails

- **Multi-File Schema**: Prisma schema models are separated in `prisma/schema/*.prisma`. Keep models partitioned by domain.
- **Safety First**: NEVER execute `prisma migrate reset` or drop database tables.
- Use `npm run check` and `prisma generate` to keep Prisma client types in sync.

---

## 5. Verification Commands

Always verify changes before opening PRs:

```bash
npm run check          # Type-check and ESLint
npm run build          # Production TypeScript compilation
npm run test:unit      # Fast unit tests
npm test               # All tests
```
