---
name: release
description: Cut a new release of this project (TMS) — bump the version, draft a CHANGELOG.md entry, tag it, and merge it into master and develop. Use when the user asks to "cut a release", "make a release", "release a new version", "bump the version and release", or invokes /release.
tools: Bash, Read, Edit, Grep, Glob, AskUserQuestion
---

# Release

Cuts a release for the `tms` repo, following the branching pattern this project
already uses (`release/x.y.z` off `develop`, merged into both `master` and
`develop`), plus the changelog/tagging discipline that was originally in place
up to v0.4.0 and has lapsed since (0.5.x/0.6.0 shipped with a version bump only
— no changelog entry, no tag).

**This skill never pushes to origin.** It stops once everything is committed,
tagged, and merged locally, and hands back an explicit `git push` command for
the user to run themselves after reviewing.

## 0. Determine the bump type

The user should specify `patch`, `minor`, `major`, or an exact version (e.g.
`0.7.0`) when invoking this skill. If they didn't, ask before doing anything
else — don't guess. This repo's commit messages are plain (not Conventional
Commits), so there is no reliable signal to infer the bump type from history.

Use AskUserQuestion with exactly these four options every time this question
is needed (don't reword or drop options between runs):

- **Patch** — bug fixes only, no new features
- **Minor** — new features, backwards compatible
- **Major** — breaking changes
- **Exact version** — user provides the literal version string

## 1. Preflight checks

Run these and abort with a clear explanation if any fail — don't try to work
around them:

```bash
git status                      # must be clean — stash/ask the user if not
git rev-parse --abbrev-ref HEAD # must be `develop`
git fetch origin
git log HEAD..origin/develop --oneline   # must be empty — local develop must not be behind
```

If the current branch isn't `develop`, ask the user before switching — don't
assume it's safe to check out over uncommitted work.

## 2. Compute the new version

Read the current `version` from `package.json`. Compute the bumped semver
yourself (patch: z+1, minor: y+1/z=0, major: x+1/y=0/z=0), or use the exact
version the user gave.

If there's any ambiguity (e.g. they said "minor" but the current version
already looks pre-release-ish, or the computed version doesn't look right for
some other reason), stop and use AskUserQuestion before branching. Standard
form for this question every time: state the computed version and the reason
it's ambiguous, then offer **Use `<computed version>`** vs **Let me specify a
different version** as the two options. Don't just mention the ambiguity in
prose and proceed — get an explicit answer.

## 3. Create the release branch

```bash
git checkout -b release/<version> develop
```

## 4. Bump the version

Edit `package.json`'s `"version"` field to `<version>`. Then run `pnpm install`
so the lockfile stays consistent (it may or may not produce a diff — either is
fine, just don't force one).

## 5. Draft the CHANGELOG.md entry

Two different "previous version" concepts matter here — don't conflate them:

- **Last shipped version** = whatever `package.json` had before your bump in
  step 4 (this is what actually went out to users).
- **Last documented version** = the topmost `## [x.y.z]` entry currently in
  `CHANGELOG.md` (this is v0.4.0 as of this writing — everything shipped since
  is undocumented).

Get the commits to summarize:

```bash
git log v<last-documented-version>..HEAD --oneline --no-merges
```

**If last shipped != last documented** (i.e. there's a backlog of undocumented
releases), stop and use AskUserQuestion — don't silently pick one. Standard
form for this question every time: tell the user which versions are
undocumented, then offer these three options:

- **Backfill as one combined entry** — all undocumented versions summarized
  under a single changelog section
- **Backfill as separate per-version entries** — one changelog section per
  undocumented version
- **Leave the gap, document only this release** — don't touch the backlog

Categorize the commits into sections matching the existing style in
`CHANGELOG.md` (`### Features`, `### Bug Fixes`, `### Security`,
`### Performance`, `### Dependencies`, etc.) — read each commit's message (and
diff, if the message is too terse like "Style fix" or "Missing components") to
judge which bucket it belongs in.

**Write every bullet for an end user of the app, not a developer.** This is
the most important part of this step:

- Plain language, no jargon. Say what changed for someone using the training
  system, not what changed in the code. "Fixed" not "fix"; describe the
  visible behavior, not the mechanism.
- No internal details: no file names, component names, variable/table names,
  library names, or implementation approach. "Users can now scroll through
  the full list on the Admin page" not "fixed v-main missing the scrollable
  prop causing overflow clipping."
- Skip anything with no user-visible effect (refactors, lint fixes, dependency
  bumps with no behavior change, internal test helpers, CI/config tweaks) —
  don't force every commit into a bullet.
- One line each. If several commits amount to one user-visible change,
  collapse them into a single bullet rather than listing each commit.

Don't link entries to GitHub (commit links, compare links, etc.) — the repo is
private, so those links are dead weight for anyone reading the changelog
without repo access.

Insert the new section at the top of `CHANGELOG.md`, directly under the `#
Changelog` header, in this format (matching existing entries):

```markdown
## <version> (<YYYY-MM-DD>)

### Features

* <summary>

### Bug Fixes

* <summary>
```

Omit any section with no matching commits. Use today's date.

## 6. Pause and show the diff — do not commit yet

Show the user the drafted `CHANGELOG.md` section and the `package.json`
version diff, then stop and use AskUserQuestion before running any
`git commit`. Standard form for this question every time: **Approve and
commit**, **Edit wording**, or **Cancel**. This applies every time this skill
runs, even if the user approved a previous release commit earlier in the same
session — approval doesn't carry forward.

If they pick edit, make the changes and re-show the diff with the same
question again. Don't default to a "looks good, proceeding" pattern.

## 7. Commit and tag

Only after the user has explicitly approved the diff in step 6:

```bash
git add package.json pnpm-lock.yaml CHANGELOG.md
git commit -m "chore(release): <version>"
git tag -a v<version> -m "v<version>"
```

(The one-line commit message convention here matches this repo's existing
release commits like `0.6.0` and `chore(release): 0.4.0` — no body needed.)

## 8. Verify the build

```bash
pnpm build
```

This must pass clean before merging anywhere. If it fails, fix the issue on
the release branch (don't merge a broken build into master), re-commit, and
re-run.

## 9. Merge into master and develop

```bash
git checkout master
git pull origin master
git merge --no-ff release/<version> -m "Merge branch 'release/<version>' into master"

git checkout develop
git pull origin develop
git merge --no-ff release/<version> -m "Merge branch 'release/<version>' into develop"
```

If either merge conflicts, stop and hand it back to the user rather than
resolving conflicts unilaterally — these are shared branches.

The `release/<version>` branch is left in place locally afterward (matches
existing practice — old release branches like `release/0.6.0` are still
around locally, not deleted).

## 10. Hand off — do not push

Report a summary: version bumped, changelog entry added (and whether a
backlog gap was addressed or left), tag created, both merges done locally,
build verified. Then give the user the exact command to run themselves:

```bash
git push origin master develop --tags
```

Do not run this yourself.
