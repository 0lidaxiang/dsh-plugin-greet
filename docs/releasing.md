# Releasing dsh-plugin-greet

This procedure releases only `dsh-plugin-greet` from `0lidaxiang/dsh-plugin-greet`. It does not release DeepSeek Harness or any `@deepseek-ai/*` package.

## Prepare and validate

1. Inspect the working tree and remote, fetch the current branch, and preserve unrelated changes.
2. Update the package and lockfile version together, for example with `npm version patch --no-git-tag-version --ignore-scripts`. Use a fresh version and keep existing release tags intact.
3. Run `npm run check` and the relevant compatibility checks using the npm version pinned in the publish workflow and a supported Node runtime. `npm run test:compat -- 0.2.2-rc.1` exercises the default supported Harness; the publish workflow also verifies `0.2.1-rc.5`, and the CI matrix covers the documented preview version. Review the staged diff and run `git diff --check`.
4. Commit and push the intended changes. Wait for the commit's CI checks to pass, then create and push the matching `vX.Y.Z` tag.

## Publish through OIDC

Dispatch `.github/workflows/publish.yml` from that release tag with the boolean input `publish=true`. With GitHub CLI, the command is:

```sh
gh workflow run publish.yml --repo 0lidaxiang/dsh-plugin-greet --ref vX.Y.Z -f publish=true
```

An authenticated GitHub REST workflow-dispatch request is equivalent. Use the available authenticated tool; do not print credentials or depend on a temporary helper from a previous chat.

The workflow checks installation and behavior, validates the tag against the package version, packs and previews publication, then passes the exact tarball to the hosted OIDC publish job. `publish=false` runs a rehearsal without uploading to npm. The `npm-publish` GitHub environment permits `v*` tags. An ordinary release needs no npm write token or interactive npm authentication.

The existing npm trusted publisher has these settings:

| Setting | Value |
|---|---|
| Package | `dsh-plugin-greet` |
| Provider | GitHub Actions |
| Organization/user | `0lidaxiang` |
| Repository | `dsh-plugin-greet` |
| Workflow filename | `publish.yml` |
| Environment | `npm-publish` |
| Direct publishing | Allowed |

Reconfigure npm only if these identifiers change or npm reports an actual authorization problem. Trusted-publisher management may require the user's 2FA even when ordinary OIDC publishing works.

## Verify completion

Wait for the workflow to finish successfully. Query the official registry for the expected version, publisher, provenance, and intended dist-tag; a stable release should become `latest`. The publisher should be GitHub Actions. An upload success followed by a temporary registry 404 can mean npm is still processing the package; wait and retry the query before diagnosing an authorization failure.

```sh
npm view dsh-plugin-greet@X.Y.Z version _npmUser dist.attestations --json --registry=https://registry.npmjs.org
npm view dsh-plugin-greet dist-tags.latest --json --registry=https://registry.npmjs.org
npm run test:compat -- 0.2.2-rc.1 --published
```

Run the published check from the release checkout so its package version matches the target. Report the released version, workflow URL, checks actually run, and any remaining blocker. Existing users do not need to reinstall because the publishing mechanism changed.
