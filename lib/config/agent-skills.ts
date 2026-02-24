/**
 * Read agent system prompts and config from DB at runtime.
 * Valid slugs: screenshot-analysis, industry-seo, score, creative-modern, creative-classy, creative-unique
 */

import type { AgentSkill } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const VALID_SLUGS = new Set([
  "screenshot-analysis",
  "industry-seo",
  "score",
  "creative-modern",
  "creative-classy",
  "creative-unique",
]);

/**
 * Full skill record for the given slug.
 */
export async function getAgentSkill(agentSlug: string): Promise<AgentSkill> {
  const skill = await prisma.agentSkill.findFirst({
    where: { agentSlug, active: true },
  });
  if (!skill) {
    throw new Error(`No active skill found for agent: ${agentSlug}`);
  }
  return skill;
}

/**
 * Just the system prompt string.
 */
export async function getAgentSystemPrompt(agentSlug: string): Promise<string> {
  const skill = await getAgentSkill(agentSlug);
  return skill.systemPrompt;
}

/**
 * All active skills in one query (for pipeline startup).
 */
export async function getAllActiveSkills(): Promise<AgentSkill[]> {
  const skills = await prisma.agentSkill.findMany({
    where: { active: true },
    orderBy: [{ category: "asc" }, { agentSlug: "asc" }],
  });
  return skills;
}

export { VALID_SLUGS };
