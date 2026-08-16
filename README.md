# dsh-plugin-greet

English | [简体中文](docs/README.zh-CN.md)

A beginner-friendly, installable DeepSeek Harness plugin that demonstrates bundle distribution, profile composition, plugin configuration, tool schemas, structured output, validation, testing, and a real model-driven tool call.

> This is a community example, not an official DeepSeek AI plugin. DeepSeek Harness is currently in Developer Preview, so future releases may require compatibility updates.

![greet tool call result](docs/greet-tool-result.png)

## What you will learn

This repository keeps the implementation in one small entry file so that a new plugin author can follow the complete path:

```text
User prompt
  → model chooses the greet tool
  → argument schema checks the shape
  → execute validates and normalizes values
  → the tool returns structured data
  → output.render creates model-facing text
  → the model writes its final response
```

The example covers:

- exporting a validated plugin `Config`
- injecting and using the Harness `tools` service
- required and optional tool arguments
- English and Chinese greetings
- friendly and formal styles
- structured canonical output with a text renderer
- actionable validation errors
- unit tests and CI packaging checks

## Tool contract

The plugin registers one model-callable tool named `greet`.

### Input

| Field | Required | Values | Default |
| --- | --- | --- | --- |
| `name` | Yes | Non-empty string, at most 80 characters | — |
| `language` | No | `en`, `zh` | Plugin configuration |
| `style` | No | `friendly`, `formal` | Plugin configuration |

Leading and trailing whitespace is removed from `name`. Unknown arguments, empty names, unsupported languages, and unsupported styles are rejected with clear errors.

### Output

The canonical result is structured data:

```json
{
  "message": "Hello, Ada!",
  "name": "Ada",
  "language": "en",
  "style": "friendly"
}
```

`output.render` converts that value into the model-facing text:

```text
Hello, Ada!
```

This separation lets other plugins or policies use the structured fields without making the model read raw JSON.

## Greeting examples

| Language | Style | Result |
| --- | --- | --- |
| English | Friendly | `Hello, Ada!` |
| English | Formal | `Greetings, Ada.` |
| Chinese | Friendly | `你好，小明！` |
| Chinese | Formal | `您好，小明。` |

## Install from npm

Stop any running DeepSeek Harness instance, then install the package into the `web` profile:

```sh
npx @deepseek-ai/dsh plugin --profile web add dsh-plugin-greet@0.2.0
```

This command does more than a regular `npm install`: it installs the package into the selected Harness profile and adds its declared bundle to the profile composition.

Before starting, confirm that the bundle is present in the final configuration:

```sh
npx @deepseek-ai/dsh --profile web --dump-config
```

Then start the Web UI:

```sh
npx @deepseek-ai/dsh web
```

## Try the tool

Open [http://127.0.0.1:3080](http://127.0.0.1:3080) and send:

```text
You must use the greet tool to greet Ada in a friendly English style.
```

The expected tool call is:

```text
IN  { "name": "Ada", "language": "en", "style": "friendly" }
OUT Hello, Ada!
```

Try Chinese formal output:

```text
You must use the greet tool to greet 小明 in formal Chinese.
```

Expected result:

```text
IN  { "name": "小明", "language": "zh", "style": "formal" }
OUT 您好，小明。
```

The plugin does not listen for keywords such as `Hello`. It makes the tool available to the model, and the model decides whether to call it. Explicitly naming the `greet` tool makes the behavior easier to verify.

## Configure the plugin

The exported configuration schema supplies these defaults:

```yaml
greeting: Hello
punctuation: "!"
defaultLanguage: en
defaultStyle: friendly
```

To override them, restate the plugin row in a later patch layer, such as the profile's `cordis.patch.yml`:

```yaml
- insert:
    - id: greet-tool
      name: dsh-plugin-greet
      config:
        greeting: Hi
        punctuation: "!"
        defaultLanguage: en
        defaultStyle: friendly
```

With that configuration, a call containing only `{ "name": "Grace" }` returns `Hi, Grace!`.

`greeting` and `punctuation` customize friendly English output. Chinese and formal wording use the built-in examples shown above. `defaultLanguage` and `defaultStyle` are used only when the model omits those arguments.

Later patch layers replace the entire row configuration rather than deep-merging individual keys, so keep `id`, `name`, and the complete desired `config` together.

## Install from GitHub

To install the current development branch:

```sh
npx @deepseek-ai/dsh plugin --profile web add \
  github:0lidaxiang/dsh-plugin-greet#master
```

For stable usage, prefer a published npm version, release tag, or specific commit SHA.

## Install from a local checkout

Run this command from the parent directory of the repository:

```sh
npx @deepseek-ai/dsh plugin --profile web add ./dsh-plugin-greet
```

After changing the code, restart DeepSeek Harness and verify the tool through the chat interface.

## Develop and test

Install dependencies and run the unit tests:

```sh
npm install
npm test
```

Run the complete local check, including the npm package preview:

```sh
npm run check
```

The test suite verifies configuration defaults, registration metadata, all four greeting modes, structured output rendering, whitespace normalization, invalid values, unknown arguments, and length limits. GitHub Actions runs the same checks on Node.js 20 and 22.

## Troubleshooting

### The model replies but does not call `greet`

Say explicitly: `You must use the greet tool...`. A normal greeting such as `Hello` does not force a tool call.

### The tool is not listed

Stop the running Harness process, reinstall the plugin into the same profile, inspect `--dump-config`, and then restart the Web UI.

### `npm install dsh-plugin-greet` worked, but the tool is missing

A regular npm install only adds a dependency to the current Node.js project. Use `dsh plugin --profile <name> add ...` to install and compose the bundle into a Harness profile.

### My configuration did not take effect

Make sure your later patch restates the row with the same `id` (`greet-tool`), the package `name`, and the complete `config` object.

## Project structure

```text
dsh-plugin-greet/
├── .github/workflows/ci.yml  # Tests and package checks
├── docs/
│   ├── README.zh-CN.md       # Chinese documentation
│   └── greet-tool-result.png # README screenshot
├── tests/greet.test.js       # Node.js unit tests
├── cordis.patch.yml          # Inserts the plugin into a profile
├── index.js                  # Config and greet tool implementation
├── package-lock.json         # Reproducible dependency versions
├── package.json              # Package and dsh.bundle metadata
└── LICENSE
```

## Security and compatibility

DeepSeek Harness plugins run inside the host process. Review third-party plugin source code before installation, and prefer a pinned release tag or commit SHA.

The plugin has no network, filesystem, shell, or credential access. It depends only on the official `@deepseek-ai/schemastery` package for configuration validation.

The original `0.1.x` release line was verified with `@deepseek-ai/dsh 0.1.0-rc.6`. Run the included tests and a real profile installation when upgrading Harness versions.

## License

[MIT](LICENSE)
