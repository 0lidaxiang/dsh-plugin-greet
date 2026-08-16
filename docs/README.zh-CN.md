# dsh-plugin-greet

[English](../README.md) | 简体中文

一个面向新手、可直接安装的 DeepSeek Harness 社区插件，用来演示 Bundle 分发、Profile 装配、插件配置、工具 Schema、结构化输出、输入校验、自动测试和真实模型调用。

> 本项目是社区示例，不是 DeepSeek AI 官方插件。DeepSeek Harness 目前仍处于 Developer Preview，后续版本可能需要调整兼容性。

![greet 工具调用结果](greet-tool-result.png)

## 你能学到什么

项目把核心实现保留在一个小型入口文件中，让新手可以顺着完整链路阅读：

```text
用户提示词
  → 模型决定调用 greet 工具
  → 参数 Schema 检查数据结构
  → execute 校验并规范化参数
  → 工具返回结构化数据
  → output.render 生成模型可读文本
  → 模型组织最终回复
```

这个示例涵盖：

- 导出经过校验的插件 `Config`
- 注入并使用 Harness 的 `tools` 服务
- 必填和可选工具参数
- 中文和英文问候
- 友好和正式两种语气
- 结构化规范输出与文本渲染
- 清晰、可操作的参数错误
- 单元测试和 CI 打包检查

## 工具约定

插件向模型注册一个名为 `greet` 的工具。

### 输入

| 字段 | 必填 | 可选值 | 默认值 |
| --- | --- | --- | --- |
| `name` | 是 | 非空字符串，最多 80 个字符 | — |
| `language` | 否 | `en`、`zh` | 插件配置 |
| `style` | 否 | `friendly`、`formal` | 插件配置 |

插件会移除 `name` 开头和结尾的空白。未知参数、空名字、不支持的语言和不支持的语气都会返回明确错误。

### 输出

工具的规范结果是结构化数据：

```json
{
  "message": "Hello, Ada!",
  "name": "Ada",
  "language": "en",
  "style": "friendly"
}
```

`output.render` 会把这个结果转换成模型可读文本：

```text
Hello, Ada!
```

这样其他插件或策略可以使用结构化字段，同时不需要让模型读取原始 JSON。

## 问候示例

| 语言 | 语气 | 结果 |
| --- | --- | --- |
| 英文 | 友好 | `Hello, Ada!` |
| 英文 | 正式 | `Greetings, Ada.` |
| 中文 | 友好 | `你好，小明！` |
| 中文 | 正式 | `您好，小明。` |

## 从 npm 安装

先停止正在运行的 DeepSeek Harness，然后把包装进 `web` Profile：

```sh
npx @deepseek-ai/dsh plugin --profile web add dsh-plugin-greet@0.2.0
```

这条命令不只是普通的 `npm install`：它会把包装进指定的 Harness Profile，并把包声明的 Bundle 加入 Profile 组合配置。

启动前确认 Bundle 已进入最终配置：

```sh
npx @deepseek-ai/dsh --profile web --dump-config
```

然后启动 Web UI：

```sh
npx @deepseek-ai/dsh web
```

## 调用工具

打开 [http://127.0.0.1:3080](http://127.0.0.1:3080)，发送：

```text
请务必调用 greet 工具，用友好的英文向 Ada 问好。
```

预期工具调用：

```text
IN  { "name": "Ada", "language": "en", "style": "friendly" }
OUT Hello, Ada!
```

再试试正式中文：

```text
请务必调用 greet 工具，用正式中文向小明问好。
```

预期结果：

```text
IN  { "name": "小明", "language": "zh", "style": "formal" }
OUT 您好，小明。
```

插件不会监听 `Hello` 等关键词。它只是让模型能够使用 `greet` 工具，是否调用由模型决定。明确指定 `greet` 工具，更容易稳定验证插件行为。

## 配置插件

导出的配置 Schema 提供以下默认值：

```yaml
greeting: Hello
punctuation: "!"
defaultLanguage: en
defaultStyle: friendly
```

如需覆盖默认值，可在更晚应用的 patch 层中重新声明插件行，例如 Profile 自己的 `cordis.patch.yml`：

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

使用这份配置后，只传入 `{ "name": "Grace" }` 会返回 `Hi, Grace!`。

`greeting` 和 `punctuation` 用于自定义友好英文输出；中文和正式措辞使用上表示例中的内置文本。模型省略参数时，插件才会使用 `defaultLanguage` 和 `defaultStyle`。

后应用的 patch 会替换整行配置，而不是深度合并单个字段。因此请把 `id`、`name` 和完整的 `config` 放在一起。

## 从 GitHub 安装

安装当前开发分支：

```sh
npx @deepseek-ai/dsh plugin --profile web add \
  github:0lidaxiang/dsh-plugin-greet#master
```

稳定使用建议选择已发布的 npm 版本、release tag 或具体 commit SHA。

## 本地开发安装

在仓库上一级目录执行：

```sh
npx @deepseek-ai/dsh plugin --profile web add ./dsh-plugin-greet
```

修改代码后重启 DeepSeek Harness，再通过聊天窗口验证工具调用。

## 开发与测试

安装依赖并运行单元测试：

```sh
npm install
npm test
```

执行完整本地检查，包括 npm 发布包预览：

```sh
npm run check
```

测试覆盖配置默认值、工具注册信息、四种问候模式、结构化输出渲染、空白处理、非法值、未知参数和长度限制。GitHub Actions 会在 Node.js 20 和 22 上执行同样的检查。

## 常见问题

### 模型回复了，但没有调用 `greet`

请明确发送“请务必调用 greet 工具……”。普通的 `Hello` 或“你好”不会强制触发工具。

### 工具列表中找不到 `greet`

停止正在运行的 Harness，重新安装到同一个 Profile，使用 `--dump-config` 检查配置，然后重启 Web UI。

### `npm install dsh-plugin-greet` 成功了，但工具仍然不存在

普通 npm 安装只会把依赖加入当前 Node.js 项目。请使用 `dsh plugin --profile <name> add ...` 把 Bundle 安装并装配进 Harness Profile。

### 修改配置后没有生效

确认后应用的 patch 使用相同的 `id`（`greet-tool`），并同时写出包 `name` 和完整 `config`。

## 文件结构

```text
dsh-plugin-greet/
├── .github/workflows/ci.yml  # 自动测试与打包检查
├── docs/
│   ├── README.zh-CN.md       # 中文文档
│   └── greet-tool-result.png # README 截图
├── tests/greet.test.js       # Node.js 单元测试
├── cordis.patch.yml          # 把插件插入 Profile
├── index.js                  # Config 与 greet 工具实现
├── package-lock.json         # 可复现的依赖版本
├── package.json              # npm 包与 dsh.bundle 信息
└── LICENSE
```

## 安全与兼容性

DeepSeek Harness 插件运行在宿主进程中。安装第三方插件前请检查源码，并优先固定 release tag 或 commit SHA。

插件不访问网络、文件系统、Shell 或凭据，只依赖 DeepSeek AI 官方的 `@deepseek-ai/schemastery` 完成配置校验。

最初的 `0.1.x` 版本已使用 `@deepseek-ai/dsh 0.1.0-rc.6` 完成验证。升级 Harness 版本后，建议重新运行项目测试并做一次真实 Profile 安装。

## License

[MIT](../LICENSE)
