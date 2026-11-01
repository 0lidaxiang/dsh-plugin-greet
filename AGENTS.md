# Agent instructions for dsh-plugin-greet

## Project scope

This is the user's community plugin: npm package `dsh-plugin-greet`, GitHub repository `0lidaxiang/dsh-plugin-greet`. Confirm the working directory, Git remote, and package name before editing, committing, configuring npm, or releasing. The adjacent `../deepseek-harness` checkout is upstream reference material; it and the `@deepseek-ai/*` packages are outside this project's release scope unless explicitly requested.

## Working with the user

When the user asks to publish a version, complete the release end to end: choose the appropriate version, validate, commit and push, tag, dispatch the OIDC workflow, wait for its result, and verify the published package. That request authorizes these routine steps; do not repeatedly ask the user to perform them. Use their specified version when provided; use a patch version for backward-compatible maintenance when no version is specified. Ask only for a material unresolved choice or an authentication step that actually requires the user.

A code change or commit request alone does not request an npm release. Documentation and instruction-only changes do not need a version bump or release unless requested. Inspect existing uncommitted changes and commit only this task's files.

## Implementation and validation

Keep the plugin small and use the host's Harness services. Do not add another copy of `dsh-tools` to a profile to suppress an expected missing-peer warning. Preserve tested Harness versions and their matching Cordis dependencies; change compatibility claims only with evidence. Follow the existing English/Chinese README pair when updating user-facing instructions.

Run checks proportionate to the change. Plugin or installation changes use `npm run check` and the relevant `npm run test:compat -- <Harness version>`; CI owns the full supported matrix. Documentation-only edits need link/content review and `git diff --check`, not a repeated runtime suite. The compatibility check covers real PTY input/output, plugin registration and execution, invalid arguments, Web authentication, and HTML without a model call.

## npm and OIDC release rules

The release procedure and npm settings live in [docs/releasing.md](docs/releasing.md); the executable authority is [.github/workflows/publish.yml](.github/workflows/publish.yml). Use its pinned npm CLI with a supported Node runtime. The plugin's consumer Node engine range is a separate compatibility promise.

- Use `https://registry.npmjs.org` explicitly for registry operations; the machine's default registry may be a mirror. Do not change global npm configuration to complete a project release.
- Keep installation-script permissions at npm 12 defaults for the default-policy test. Retain normal optional platform dependencies for the terminal test; omitting them can remove Koffi's native binary.
- npm JSON formats vary by CLI version. Preserve the normalization in [scripts/check-compat.mjs](scripts/check-compat.mjs): selected fields may be wrapped in arrays, and pack results may be keyed by package name.
- Publish tarballs using absolute paths. An unprefixed relative path such as `package/example.tgz` can be parsed as a Git dependency. Do not enable Git dependencies or all installation scripts as a workaround.
- Publish through GitHub Actions OIDC, using the verified tarball from its verification job. Do not add an npm write-token fallback or publish locally to bypass a failing workflow.
- Do not overwrite existing release tags or published npm versions. Diagnose failures before retrying; choose a new patch version if the release workflow itself needs a correction.
- A successful workflow dispatch is not a successful publication. Wait for the publish job, registry availability, and the published-install compatibility check. npm may process an uploaded package for several minutes before it becomes downloadable.

Use existing authorized credentials through normal tools. Never put tokens, cookies, recovery codes, or passwords into repository files or logs. OIDC publishing normally needs no npm login or 2FA; changing trusted-publisher settings is a separate operation that may require the user's authentication.
