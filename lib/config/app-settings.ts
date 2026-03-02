import { prisma } from "@/lib/prisma";

/** Read a single app setting from the DB, returning `fallback` if not found. */
export async function getAppSetting(key: string, fallback: string): Promise<string> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? fallback;
}

/** Read the analysis cooldown in days (default 30). */
export async function getAnalysisCooldownDays(): Promise<number> {
  const val = await getAppSetting("analysis_cooldown_days", "30");
  const days = parseInt(val, 10);
  return Number.isFinite(days) && days >= 0 ? days : 30;
}
