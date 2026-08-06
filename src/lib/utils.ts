import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely parse a JSON string that is expected to be a specific type.
 * If parsing fails or the result is not the expected type, returns the fallback.
 */
export function safeJsonParse<T>(
  value: string | null | undefined,
  fallback: T,
  expectArray?: boolean
): T {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    if (expectArray && !Array.isArray(parsed)) {
      // If we expected an array but got something else (e.g. a bare string),
      // wrap it in an array
      return [parsed] as unknown as T;
    }
    return parsed as T;
  } catch {
    // JSON.parse failed — it's likely a raw string, not JSON.
    // If we expect an array, split by comma and wrap.
    if (expectArray) {
      return value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean) as unknown as T;
    }
    return fallback;
  }
}

/**
 * Ensure a value is a string array. Useful for defensive coding in components.
 */
export function ensureStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string') {
    if (value === '' || value === '[]') return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string');
      // Parsed but not an array — treat as single-item array
      return [String(parsed)];
    } catch {
      return value.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

/**
 * Ensure a value is a Record<string, string>. Useful for metadata fields.
 */
export function ensureRecord(value: unknown): Record<string, string> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, string>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, string>;
      }
    } catch {
      // not valid JSON
    }
  }
  return {};
}
