import OpenAI from "openai";
import { client, enableThinking, modelName } from "./model.js";
import {
  appendSkillInstructions,
  discoverSkills,
  loadSkill,
  type Skill,
  type SkillMetadata,
} from "./skills.js";
import { executeTool, tools } from "./tools.js";

const MAX_STEPS = 5;

const systemPrompt = `你是一个用于学习 Agent 原理的助手。
当用户的问题需要实时信息或本地题库时，必须使用提供的工具，不要编造工具结果。
拿到工具结果后，用简洁中文回答用户。`;

export interface AgentOptions {
  skillName?: string;
  autoSkill?: boolean;
}

async function selectSkill(
  userInput: string,
  skills: SkillMetadata[],
): Promise<string | undefined> {
  if (skills.length === 0) {
    return undefined;
  }

  console.log("[Skill discovery] 只向模型披露 name + description");
  for (const skill of skills) {
    console.log(`- ${skill.name}: ${skill.description}`);
  }

  const skillNames = skills.map((skill) => skill.name);
  const selectionTool: OpenAI.Responses.FunctionTool = {
    type: "function",
    name: "select_skill",
    description: "为用户任务选择一个 Skill；没有适用项时选择 none。",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          enum: ["none", ...skillNames],
        },
      },
      required: ["name"],
      additionalProperties: false,
    },
    strict: true,
  };

  const catalog = skills
    .map((skill) => `- ${skill.name}: ${skill.description}`)
    .join("\n");
  const response = await client.responses.create({
    model: modelName,
    instructions: `你是 Agent 的 Skill 路由器。只根据用户目标和下面的元数据选择 Skill，不要回答用户问题，也不要假设 Skill 正文内容。\n\n${catalog}`,
    input: [{ role: "user", content: userInput }],
    tools: [selectionTool],
    tool_choice: { type: "function", name: "select_skill" },
  });
  const toolCall = response.output.find(
    (item): item is OpenAI.Responses.ResponseFunctionToolCall =>
      item.type === "function_call" && item.name === "select_skill",
  );

  if (!toolCall) {
    throw new Error("Skill 路由器没有返回 select_skill 调用。 ");
  }

  const parsed = JSON.parse(toolCall.arguments) as { name?: unknown };
  if (typeof parsed.name !== "string") {
    throw new Error("Skill 路由器返回了无效名称。 ");
  }

  return parsed.name === "none" ? undefined : parsed.name;
}

async function resolveSkill(
  userInput: string,
  options: AgentOptions,
): Promise<Skill | undefined> {
  if (options.skillName) {
    console.log(`[Skill] 显式选择：${options.skillName}`);
    return loadSkill(options.skillName);
  }

  if (!options.autoSkill) {
    return undefined;
  }

  const selectedName = await selectSkill(userInput, await discoverSkills());
  if (!selectedName) {
    console.log("[Skill] 自动选择：无匹配 Skill");
    return undefined;
  }

  console.log(`[Skill] 自动选择：${selectedName}`);
  return loadSkill(selectedName);
}

export async function runAgent(
  userInput: string,
  options: AgentOptions = {},
): Promise<string> {
  const skill = await resolveSkill(userInput, options);
  const instructions = appendSkillInstructions(systemPrompt, skill);

  if (skill) {
    console.log(`[Skill] 已加载正文：${skill.metadata.name}`);
  }

  const input: OpenAI.Responses.ResponseInput = [
    { role: "user", content: userInput },
  ];

  for (let step = 1; step <= MAX_STEPS; step += 1) {
    console.log(`\n[Agent] 第 ${step} 步：请求模型`);

    // enable_thinking 是百炼扩展字段，不属于 OpenAI 标准 Responses 类型。
    // 先赋给扩展类型变量，可以保留类型检查，又允许兼容服务接收该字段。
    const request: OpenAI.Responses.ResponseCreateParamsNonStreaming & {
      enable_thinking: boolean;
    } = {
      model: modelName,
      instructions,
      input,
      tools,
      tool_choice: "auto",
      enable_thinking: enableThinking,
    };

    const response = await client.responses.create(request);

    for (const item of response.output) {
      if (item.type === "reasoning" && item.summary.length > 0) {
        console.log("[Reasoning summary]");
        for (const summary of item.summary) {
          if (summary.type === "summary_text") {
            console.log(summary.text);
          }
        }
      }
    }

    const toolCalls = response.output.filter(
      (item): item is OpenAI.Responses.ResponseFunctionToolCall =>
        item.type === "function_call",
    );

    if (toolCalls.length === 0) {
      console.log("[Agent] 模型选择直接回答，循环结束");
      return response.output_text;
    }

    console.log(`[Agent] 模型选择调用 ${toolCalls.length} 个工具`);

    // 模型刚才产出的 reasoning 和 function_call 也属于下一步上下文。
    input.push(...response.output);

    for (const toolCall of toolCalls) {
      console.log(`[Tool] ${toolCall.name}`, toolCall.arguments);

      let result: unknown;

      try {
        result = await executeTool(toolCall.name, toolCall.arguments);
      } catch (error) {
        result = {
          error: error instanceof Error ? error.message : String(error),
        };
      }

      console.log("[Tool result]", result);

      input.push({
        type: "function_call_output",
        call_id: toolCall.call_id,
        output: JSON.stringify(result),
      });
    }
  }

  throw new Error(`Agent 超过最大执行步数 ${MAX_STEPS}，已主动停止。`);
}
