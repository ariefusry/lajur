/**
 * Models asked for "JSON only" in the prompt (dev-only providers without response_format) sometimes wrap it in
 * ``` fences or add a sentence around it. This cuts out the JSON object.
 */

/** The outermost {...} of a finished answer, or null if there is none. */
export function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : null;
}
