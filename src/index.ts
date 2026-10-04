import { runAgent } from "./agent.js";

function parseArguments(args: string[]) {
  let skillName: string | undefined;
  let autoSkill = false;
  const inputParts: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--skill") {
      skillName = args[index + 1];
      if (!skillName) {
        throw new Error("--skill 后必须提供 Skill 名称。");
      }
      index += 1;
    } else if (argument === "--auto-skill") {
      autoSkill = true;
    } else if (argument) {
      inputParts.push(argument);
    }
  }

  if (skillName && autoSkill) {
    throw new Error("--skill 与 --auto-skill 不能同时使用。");
  }

  return {
    userInput: inputParts.join(" ").trim(),
    options: { skillName, autoSkill },
  };
}

let parsed: ReturnType<typeof parseArguments>;

try {
  parsed = parseArguments(process.argv.slice(2));
} catch (error) {
  console.error("[Error]", error instanceof Error ? error.message : error);
  process.exit(1);
}

if (!parsed.userInput) {
  console.error(
    '用法：npm run dev -- [--skill <name> | --auto-skill] "用户问题"',
  );
  process.exitCode = 1;
} else {
  try {
    const answer = await runAgent(parsed.userInput, parsed.options);
    console.log(`\n[Final answer]\n${answer}`);
  } catch (error) {
    console.error("\n[Error]", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
