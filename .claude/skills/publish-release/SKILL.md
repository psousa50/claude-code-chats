---
name: publish-release
description: Bump the cc-chats npm package version, tag the commit, publish to npm, and create a GitHub release with notes drafted from commit history. Use whenever the user wants to ship, cut, publish or release a new version of cc-chats — triggers for phrases like "release", "ship it", "cut a release", "bump and publish", "new version", "publish to npm", even when no version number is given. The default bump is patch; accept `patch`, `minor`, `major`, or an explicit `X.Y.Z` as the argument.
---

# publish-release

Ships a new version of `cc-chats`. Replaces the manual multi-step dance of editing `package.json`, committing, tagging, pushing, `npm publish`, `gh release create`.

Why this skill exists: the maintainer's environment adds two constraints that break full automation, so the skill orchestrates the pieces it _can_ run and hands the rest back.

- `git push` is denied by the user's global settings — the skill must ask the user to run push commands themselves via the `!` prompt prefix.
- `npm publish` requires a 2FA OTP — the skill must ask for it and pass `--otp=<code>`.

## Preferences to respect

- Single-line commit messages.
- Never include author name/initials or a `Co-Authored-By` trailer in the bump commit.
- British English in any prose written to release notes.
- Match the existing bump-commit pattern: `bump version to X.Y.Z`.

## Workflow

### 1. Gather the release context

Run these in parallel:

- Read `package.json` → `CURRENT_VERSION`.
- `git describe --tags --abbrev=0` → `LAST_TAG` (strip the leading `v` to get `LAST_TAG_VERSION`).
- `git status --porcelain` — working tree must be clean; if not, list the dirty files and ask the user to commit or stash before continuing.
- `git log "$LAST_TAG..HEAD" --no-merges --pretty='%h %s'` — filter out bump commits with `grep -vE '(bump version|bump to)'`.

### 1a. Resume-mode check

Before deciding the workflow is "nothing to release", determine whether a previous run left work half-finished. A release has three side-effecting outputs: the commit+tag (local and remote), the npm package, and the GitHub release. Any of them can be missing.

If `CURRENT_VERSION == LAST_TAG_VERSION` (the bump commit and tag already exist), check:

- Is the tag on origin? `git ls-remote --tags origin "refs/tags/$LAST_TAG"` — empty output means the tag is local-only.
- Is `CURRENT_VERSION` published on npm? `npm view cc-chats@$CURRENT_VERSION version 2>/dev/null` returns the version if present, empty if not.
- Is there a GitHub release for `$LAST_TAG`? `gh release view "$LAST_TAG" 2>/dev/null` — non-zero exit means no release.

Based on what's missing:

| State                             | Resume from                            |
| --------------------------------- | -------------------------------------- |
| Tag not pushed                    | step 7 (push)                          |
| npm missing, GH release missing   | step 8 (publish) then step 9 (release) |
| npm published, GH release missing | step 9 (create release)                |
| All three present                 | Nothing to do — tell the user and stop |

When resuming, regenerate the release notes by running step 3 against the range `PREVIOUS_TAG..LAST_TAG` instead of `LAST_TAG..HEAD` — we want the notes to cover what was actually shipped in this version, not what's on HEAD. `PREVIOUS_TAG` = the tag before `LAST_TAG` in version order: `git tag --sort=v:refname | grep -B1 "^$LAST_TAG$" | head -1`.

Show the user the detected state and the proposed resume point. Ask for confirmation before proceeding.

### 1b. Normal path

If not in resume mode: if no commits remain after filtering, tell the user there's nothing to release and stop.

### 2. Decide the new version

The skill argument selects the bump:

- `patch` (default) → `X.Y.Z+1`
- `minor` → `X.Y+1.0`
- `major` → `X+1.0.0`
- An explicit `X.Y.Z` string → use as-is (must be greater than `CURRENT_VERSION`).

Repo pattern so far is patch bumps, so default accordingly. For feature-heavy releases, mention that minor might be more honest and let the user redirect.

### 3. Draft the release notes

Use this exact structure:

```
## Changes

- <subject> (<shortsha>)
- ...

[Full Changelog](https://github.com/psousa50/claude-code-chats/compare/vPREV...vNEW)
```

The commit list is whatever survived the bump filter in step 1. Keep commit subjects verbatim — don't rewrite them.

### 4. Show the plan and wait for confirmation

Present to the user:

- `CURRENT_VERSION` → `NEW_VERSION`
- The filtered commit list
- The draft release notes

Ask: "Proceed with the release?" Do not start any side-effecting step until the user confirms.

### 5. Pre-flight checks (fail fast)

On confirmation, run:

```bash
npm test
npx tsc --noEmit
```

If either fails, stop and surface the failure. The user will want to fix it and re-invoke the skill.

### 6. Bump, commit, tag (local only)

```bash
# Update the version field in package.json (use the Edit tool, not sed, so you see the diff).
git add package.json
git commit -m "bump version to X.Y.Z"
git tag vX.Y.Z
```

No Co-Authored-By trailer. Single line.

### 7. Hand off the push

The user's settings deny `git push`. Tell them, verbatim:

> Run these two commands in the prompt (the `!` prefix executes them in this session so their output is visible):
>
> ```
> ! git push
> ! git push origin vX.Y.Z
> ```
>
> Reply when done.

Wait for them to confirm both pushed successfully before continuing.

### 8. Publish to npm

Try a straight publish first — if the user has a granular access token with "Bypass 2FA" enabled in `~/.npmrc`, no OTP is needed:

```bash
npm publish
```

If it succeeds, move on. If npm rejects the publish with a 401/403 and the error mentions "one-time password" or "OTP", the account requires interactive 2FA. In that case, ask the user for their 6-digit TOTP and retry:

```bash
npm publish --otp=<code>
```

If that also returns 401/403, ask for a fresh OTP and retry **once** (codes rotate every 30 seconds). If the second OTP attempt also fails, surface the error and stop — the user may need to re-authenticate or check their token/account settings.

Do not pre-emptively ask for an OTP before the token-based publish has failed. Asking unnecessarily wastes a round-trip with the user and is confusing when the token is supposed to handle auth on its own.

### 9. Create the GitHub release

Write the drafted notes to a temp file so multi-line formatting survives the shell:

```bash
cat > /tmp/release-notes-vX.Y.Z.md <<'EOF'
## Changes

- subject (sha)
...

[Full Changelog](https://github.com/psousa50/claude-code-chats/compare/vPREV...vNEW)
EOF

gh release create vX.Y.Z --title vX.Y.Z --notes-file /tmp/release-notes-vX.Y.Z.md
```

`gh release create` prints the release URL on success.

### 10. Report

Tell the user:

- Version published to npm (with link: `https://www.npmjs.com/package/cc-chats/v/X.Y.Z`)
- GitHub release URL (from step 9)
- That the local tag and commit are already in origin (because they pushed in step 7)

## Failure recovery

If something goes wrong mid-flow, the skill should help unwind rather than leave a half-cooked state:

- **Pre-flight failed** (step 5): nothing to undo — the bump commit and tag haven't been created yet. Just surface the failure.
- **User couldn't push** (step 7): the bump commit and tag are local-only. Options: (a) wait for them to resolve the push problem, (b) offer to `git reset --hard HEAD^ && git tag -d vX.Y.Z` to undo the local state. Confirm before destructive ops.
- **`npm publish` fails after retry** (step 8): commit and tag are pushed to origin; the version isn't on npm. Don't roll anything back automatically — ask the user how to proceed. They may want to diagnose (e.g. npm token scope) and re-run publish manually, or bump again to the next patch and retry.
- **`gh release create` fails** (step 9): everything else succeeded. The release can be created later with the same command; surface the exact command so the user can retry.

## What this skill does NOT do

- It does not use `npm version` — editing `package.json` manually keeps the workflow explicit and matches the repo's existing commit style.
- It does not run `git push` (denied by user settings).
- It does not store or cache the npm OTP — always ask fresh.
- It does not use release-please, semantic-release, or any conventional-commit tooling. The commit style in this repo is free-form.
