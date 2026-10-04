import OpenAI from "openai";

const apiKey = process.env.DASHSCOPE_API_KEY;

if (!apiKey) {
  throw new Error(
    "缺少 DASHSCOPE_API_KEY。请复制 .env.example 为 .env，并填入百炼 API Key。",
  );
}

export const modelName = process.env.QWEN_MODEL ?? "qwen3.7-flash";
export const enableThinking =
  (process.env.QWEN_ENABLE_THINKING ?? "true") === "true";

const baseURL = process.env.DASHSCOPE_BASE_URL?.trim();
if (!baseURL) {
  throw new Error("缺少 DASHSCOPE_BASE_URL。请在 .env 中填写支持 Responses API 的服务地址。");
}

export const client = new OpenAI({
  apiKey,
  baseURL,
});
