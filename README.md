# Agent Practice：第一阶段

这是一个刻意保持简单的 TypeScript CLI，用来观察 Agent 最核心的运行过程：

```text
用户目标 → 模型决策 → 工具执行 → 工具结果回传 → 模型继续决策或回答
```

## `openai` npm 包做了什么

它是一个带 TypeScript 类型的 API 客户端，主要负责：

- 把 `messages`、`tools` 等 JavaScript 对象转换成 HTTP 请求；
- 添加 API Key 和请求地址；
- 调用 OpenAI 兼容接口；
- 把 JSON 响应解析成带类型的对象；
- 提供统一的 API 错误对象和流式响应接口。

它不会：

- 替你实现业务工具；
- 自动执行模型返回的 tool call；
- 自动决定权限；
- 自动保存长期记忆；
- 自动保证 Agent 不死循环。

这个项目通过 `openai.responses.create()` 调用百炼的 OpenAI Responses
兼容接口。`enable_thinking` 是百炼额外支持的字段，不是 OpenAI 标准字段。

这个项目里，`src/agent.ts` 才是我们自己实现的 Agent loop。

## 文件地图

```text
src/index.ts   CLI 入口，接收用户输入
src/model.ts   创建 OpenAI 客户端，并把 baseURL 指向百炼
src/skills.ts  发现、选择并加载 Skill
src/tools.ts   声明工具并实现真正的工具函数
src/agent.ts   Agent loop：模型与工具之间来回传递消息
skills/        Agent 自己管理的 Skill 目录
```

建议按上面的顺序阅读，然后重点逐行读 `src/agent.ts`。

## 运行

建议使用 Node.js 22 或更高版本（启动脚本使用 `--env-file`）。

```bash
npm ci
cp .env.example .env
```

打开 `.env` 填入自己的百炼 API Key、支持 Responses API 的 `DASHSCOPE_BASE_URL`，
并将 `QWEN_MODEL` 改为该服务可用的模型。不是所有 OpenAI 兼容服务都支持 Responses API。
不要提交真实密钥或个人服务地址；请求会发送到你配置的服务，可能产生费用。然后运行：

```bash
npm run dev -- "给我一道 React 面试题，并告诉我上海现在几点"
```

只聊天、不需要工具时也可以运行：

```bash
npm run dev -- "用一句话解释什么是闭包"
```

观察终端日志的差异：第二条通常一步结束；第一条会先出现工具调用，再向模型发起下一步请求。

单次回答后进程退出；需要中止时在终端按 `Ctrl + C`。

## 实验入口与验证边界

这是个人学习项目，不是生产级 Agent 框架。按以下问题阅读和运行已有代码：

| 问题 | 入口 | 如何观察 |
| --- | --- | --- |
| 模型提出工具调用后，谁真正执行？ | [Agent loop](src/agent.ts)、[工具实现](src/tools.ts) | 使用上面的时间查询，观察请求、工具结果、最终回答 |
| 如何避免循环不结束？ | [MAX_STEPS](src/agent.ts) | 阅读最多 5 次主循环请求与超限错误；Skill 路由请求不计入这 5 次 |
| Skill 如何被选择并进入上下文？ | [加载器](src/skills.ts)、[面试 Skill](skills/interview-coach/SKILL.md) | 对比下面的无 Skill、显式选择、自动选择模式 |

本次公开初始化（2026-10-04）在 Node.js v24.12.0 下通过 `npm run typecheck`。
没有重新调用付费模型服务，也没有端到端自动化测试，因此类型检查通过不等于模型调用验证通过。

## Skill：渐进式披露

Skill 是 Agent 的能力，但自然语言指令最终需要进入模型上下文才能影响模型决策。这个 demo
把 Skill 的身份保留在 Agent 运行时，并分阶段向模型披露：

```text
发现：扫描本地 Skill，向路由模型仅披露 name + description
选择：显式指定，或让路由模型根据元数据自动选择
加载：选中后将 SKILL.md 正文加入任务上下文
执行：把正文标记为 activated_skill，交给模型遵循
```

显式选择 Skill（模式 A）：

```bash
npm run dev -- --skill interview-coach "给我一道 React 面试题"
```

自动选择 Skill（模式 B）：

```bash
npm run dev -- --auto-skill "模拟一场 React 面试"
```

注意：当前 `discoverSkills()` 在本地实际读取了完整文件，但只返回元数据；这里的渐进式披露
指模型看到的上下文，而不是文件系统只读取了 frontmatter。自动模式先打印元数据，选中后
才打印“已加载正文”。不带参数时仍按原来的
无 Skill 模式运行：

```bash
npm run dev -- "用一句话解释什么是闭包"
```

## 阅读时先回答四个问题

1. 模型在哪里看到“有哪些工具可用”？
2. 工具究竟是模型执行的，还是 Node.js 程序执行的？
3. 为什么要把 `response.output` 和工具结果重新添加到 `input`？
4. 为什么必须设置 `MAX_STEPS`？

## 当前刻意没有实现

- 多轮会话
- 流式输出
- 数据持久化
- 写操作审批
- RAG 和向量数据库
- Agent 框架

这些是后续可选学习方向，不代表已经实现或承诺全部加入。下一步可先研究工具错误回传和
执行步数上限，再决定是否扩展多轮会话。
