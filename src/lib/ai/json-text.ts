/**
 * Models asked for "JSON only" (without response_format, which makes OpenRouter buffer the stream) sometimes
 * wrap it in ``` fences or add a sentence around it. These helpers cut out the JSON object.
 */

/** From the first "{" onward, minus a closing fence: good enough for partial (still-streaming) parsing. */
export function jsonStart(text: string): string {
  const start = text.indexOf("{");
  return start < 0 ? "" : text.slice(start).replace(/\s*```[\s\S]*$/, "");
}

/** The outermost {...} of a finished answer, or null if there is none. */
export function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : null;
}
