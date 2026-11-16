import { createHash } from 'node:crypto';

/**
 * sha256 of a value as JSON with sorted keys. Same content → same hash, whatever
 * the key order, so publish can skip items that did not change.
 */
export function contentHash(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(sortKeys(value)))
    .digest('hex');
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(obj)
        .sort()
        .map((key) => [key, sortKeys(obj[key])]),
    );
  }
  return value;
}
