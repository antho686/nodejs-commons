# Releases are human-versioned, published only when new, and tagged only after the fact

Publication is automated; the version number is not. A human bumps `version` in the pull request that changes behaviour, and CI publishes to GitHub Packages on a push to `main` **only if that version is not already in the registry**. A run that finds the version already published logs the fact and ends successfully, having changed nothing. The commit is tagged `v<version>` **after** a successful publish, never before.

Three decisions sit inside that sentence, and each was a live choice.

## Considered Options

### Who decides the version

The rejected alternative was **CI auto-bumping** — deriving the next version from commit messages (Conventional Commits, `semantic-release`) and writing the bump back to `main`.

It was ruled out because the judgement it automates is the one judgement that actually matters. Whether a change is breaking is a claim about consumers, and the person who understands the change is the person who made it. A commit-message convention does not make that judgement, it only records whatever the author typed, while giving the appearance of rigour. This library's whole design stance is explicit contracts over convenience — `deterministicObjectHash` documents a locked output for exactly this reason — and inferring a major bump from a `feat!:` prefix is the opposite of that stance.

Auto-bumping also requires CI to push a commit to `main`, which means a workflow with write access to the default branch and a bot commit in the history of every release. Declining it keeps `main` something only humans write to.

### What triggers a publish

The rejected alternative was **driving publication from a tag or a GitHub Release**: the maintainer pushes `v0.2.0`, or clicks Release, and that event publishes.

That is the more common arrangement, and it was rejected because it makes the tag a *request* rather than a *record*. A pushed tag that then fails to publish leaves a tag in the repository naming a version that does not exist in the registry — the exact lie this ADR's ordering is designed to prevent. It also adds a second manual step, separated in time from the pull request, at which the maintainer must remember what they decided.

Triggering on `main` instead makes merging the whole release action, and makes the version in `package.json` the single source of truth for what is released.

### What "already published" means

Publishing unconditionally on every push to `main` would fail every documentation-only merge, training the maintainer to ignore a red `main`. So the run asks the registry first.

This makes the distinction between *"the registry gave a definite answer"* and *"the registry could not be reached"* load-bearing. A definite answer — the version is there, or it is provably absent — lets the run continue; an authentication or network failure fails it. Collapsing the two would turn a broken token into a silent no-release, which is the worst failure mode available: green runs, no package.

GitHub Packages complicates this, because it masks a package the caller may not read as a `404` rather than a `403`. An unusable token therefore looks identical to "never published", and no read-only probe can tell the two apart: proving the token is valid does not prove it may read *this* package.

So the registry itself settles it. When the lookup reports the version absent, the run attempts the publish, and reads the outcome as the authoritative answer: success means it really was absent, a conflict means it was already there — the routine skip, logged and green — and anything else fails the run. A token that cannot read the package also cannot publish to it, so the masked `404` surfaces as a failed publish rather than as a false release.

## Consequences

Forgetting to bump the version is not an error. The merge publishes nothing and the run is green, so a release can be missed silently — the cost of making documentation merges quiet. The tag list is the reliable record of what shipped.

Publishes are serialised, and that serialisation drops work. Only one run may be queued behind the one in flight, so when several merges land in quick succession the intermediate ones are cancelled while pending and their versions are never published — the same silent miss as forgetting to bump, arriving by a different route. Merging a release and then immediately merging another is the way to hit it.

A version can never be republished. Once `0.1.0` is in the registry, re-running `main` at that version is always a no-op, so correcting a bad release means bumping to a new version rather than replacing the old one.

Every tag in this repository was created by CI after a successful publish, so `v<version>` existing is a truthful claim that the version is installable. Nothing else in the repository may create release tags without breaking that.

No GitHub Release is created — the tag is the record. Adding Releases later would mean deciding what the notes contain, and nothing currently generates them.
