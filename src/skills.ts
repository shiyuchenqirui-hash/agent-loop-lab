import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface SkillMetadata {
  name: string;
  description: string;
}

export interface Skill {
  metadata: SkillMetadata;
  instructions: string;
}

const skillsDirectory = fileURLToPath(new URL("../skills", import.meta.url));

function parseSkill(content: string, filePath: string): Skill {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!match) {
    throw new Error(`Skill 格式错误，缺少 YAML frontmatter：${filePath}`);
  }

  const frontmatter = match[1] ?? "";
  const instructions = (match[2] ?? "").trim();
  const name = frontmatter.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1]?.trim();

  if (!name || !description || !instructions) {
    throw new Error(`Skill 必须包含 name、description 和正文：${filePath}`);
  }

  return {
    metadata: { name, description },
    instructions,
  };
}

async function readSkillFile(directoryName: string): Promise<Skill> {
  const filePath = path.join(skillsDirectory, directoryName, "SKILL.md");
  const content = await readFile(filePath, "utf8");
  return parseSkill(content, filePath);
}

export async function discoverSkills(): Promise<SkillMetadata[]> {
  const entries = await readdir(skillsDirectory, { withFileTypes: true });
  const skills = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => readSkillFile(entry.name)),
  );

  return skills.map((skill) => skill.metadata);
}

export async function loadSkill(name: string): Promise<Skill> {
  const metadata = await discoverSkills();
  const selected = metadata.find((skill) => skill.name === name);

  if (!selected) {
    throw new Error(
      `未知 Skill：${name}。可用 Skill：${metadata.map((skill) => skill.name).join(", ")}`,
    );
  }

  return readSkillFile(selected.name);
}

export function appendSkillInstructions(
  baseInstructions: string,
  skill: Skill | undefined,
): string {
  if (!skill) {
    return baseInstructions;
  }

  return `${baseInstructions}\n\n以下是 Agent 已选择并加载的 Skill。把它作为当前任务的操作说明：\n<activated_skill name="${skill.metadata.name}">\n${skill.instructions}\n</activated_skill>`;
}
