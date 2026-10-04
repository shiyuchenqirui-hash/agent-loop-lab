import OpenAI from "openai";
import { z } from "zod";

const getCurrentTimeInput = z.object({
  timeZone: z.string().default("Asia/Shanghai"),
});

const getInterviewQuestionInput = z.object({
  topic: z.enum(["javascript", "react", "browser", "ai-agent"]),
});

const questionBank = {
  javascript: "请解释事件循环中 microtask 与 macrotask 的执行顺序。",
  react: "React 中闭包为什么可能让事件处理函数读到旧 state？",
  browser: "从输入 URL 到页面可交互，浏览器主要经历了哪些阶段？",
  "ai-agent": "模型返回 tool call 后，应用程序还需要负责哪些工作？",
} as const;

export const tools: OpenAI.Responses.FunctionTool[] = [
  {
    type: "function",
    name: "get_current_time",
    description: "获取指定 IANA 时区的当前时间。",
    parameters: {
      type: "object",
      properties: {
        timeZone: {
          type: "string",
          description: "IANA 时区，例如 Asia/Shanghai。",
        },
      },
      additionalProperties: false,
    },
    strict: false,
  },
  {
    type: "function",
    name: "get_interview_question",
    description: "从本地题库中获取一道指定主题的前端或 AI Agent 面试题。",
    parameters: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          enum: ["javascript", "react", "browser", "ai-agent"],
        },
      },
      required: ["topic"],
      additionalProperties: false,
    },
    strict: true,
  },
];

export async function executeTool(name: string, rawArguments: string) {
  const parsedArguments: unknown = JSON.parse(rawArguments);

  switch (name) {
    case "get_current_time": {
      const { timeZone } = getCurrentTimeInput.parse(parsedArguments);

      return {
        timeZone,
        time: new Intl.DateTimeFormat("zh-CN", {
          dateStyle: "full",
          timeStyle: "long",
          timeZone,
        }).format(new Date()),
      };
    }

    case "get_interview_question": {
      const { topic } = getInterviewQuestionInput.parse(parsedArguments);

      return {
        topic,
        question: questionBank[topic],
      };
    }

    default:
      throw new Error(`未知工具：${name}`);
  }
}
