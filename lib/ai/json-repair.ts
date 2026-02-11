/**
 * Safe JSON parsing with repair fallbacks for Claude/LLM output.
 * Handles trailing commas, markdown code fences, unquoted keys, and extra text.
 */

export interface SafeParseJSONResult {
  success: boolean;
  data?: unknown;
  method?: "direct" | "trimmed" | "repaired" | "boundary";
}

function tryParse(s: string): unknown {
  return JSON.parse(s);
}

/** Strip markdown code fences and leading/trailing text around the JSON object/array. */
function trimWrapping(raw: string): string {
  let s = raw.trim();
  // Remove ```json ... ``` or ``` ... ```
  const fenceMatch = s.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/i);
  if (fenceMatch) s = fenceMatch[1].trim();
  const firstObj = s.indexOf("{");
  const firstArr = s.indexOf("[");
  const start =
    firstObj >= 0 && (firstArr < 0 || firstObj < firstArr)
      ? firstObj
      : firstArr >= 0
        ? firstArr
        : 0;
  const lastObj = s.lastIndexOf("}");
  const lastArr = s.lastIndexOf("]");
  const end =
    lastObj >= start && (lastArr < start || lastObj > lastArr)
      ? lastObj + 1
      : lastArr >= start
        ? lastArr + 1
        : s.length;
  return s.slice(start, end).trim();
}

/** Apply basic regex repairs: trailing commas before } or ], unquoted keys. */
function basicRepair(s: string): string {
  // Trailing commas before } or ]
  let out = s.replace(/,(\s*[}\]])/g, "$1");
  // Unquoted property names: ( { or , ) then optional whitespace, then identifier then :
  out = out.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
  return out;
}

export function safeParseJSON(raw: string): SafeParseJSONResult {
  if (typeof raw !== "string" || !raw.trim()) {
    return { success: false };
  }

  // 1. Direct parse
  try {
    const data = tryParse(raw);
    return { success: true, data, method: "direct" };
  } catch {
    // continue
  }

  // 2. Trim wrapping
  const trimmed = trimWrapping(raw);
  try {
    const data = tryParse(trimmed);
    return { success: true, data, method: "trimmed" };
  } catch {
    // continue
  }

  // 3. Basic repair on trimmed
  const repaired = basicRepair(trimmed);
  try {
    const data = tryParse(repaired);
    return { success: true, data, method: "repaired" };
  } catch {
    // continue
  }

  // 4. Boundary extraction: first { to last }
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const substring = raw.slice(firstBrace, lastBrace + 1);
    const repairedSub = basicRepair(substring);
    try {
      const data = tryParse(repairedSub);
      return { success: true, data, method: "boundary" };
    } catch {
      // continue
    }
  }

  return { success: false };
}
