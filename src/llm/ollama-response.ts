export class OllamaResponseError extends Error {}

function stripCodeFence(value: string): string {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (!fenced) return value;
  return fenced[1] ?? value;
}

export function extractFirstJsonObject(text: string): string {
  const start = text.indexOf('{');
  if (start === -1) return text.trim();

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1).trim();
    }
  }

  return text.slice(start).trim();
}

export function sanitizeModelText(raw: string): string {
  const fencedStripped = stripCodeFence(raw).trim();
  return extractFirstJsonObject(fencedStripped);
}

export function extractOllamaModelText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    throw new OllamaResponseError('Malformed Ollama payload: expected object');
  }

  const obj = payload as Record<string, unknown>;

  const response = obj.response;
  if (typeof response === 'string' && response.trim()) {
    return response;
  }

  const message = obj.message;
  if (message && typeof message === 'object') {
    const content = (message as Record<string, unknown>).content;
    if (typeof content === 'string' && content.trim()) {
      return content;
    }
  }

  throw new OllamaResponseError('Empty or unexpected Ollama response payload');
}
