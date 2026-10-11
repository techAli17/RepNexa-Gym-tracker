import type { IdGenerator } from '../application/ports/system';

declare const crypto: { getRandomValues<T extends Uint8Array>(array: T): T };

const HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

/**
 * RFC 4122 v4 UUID from a CSPRNG. On device `crypto.getRandomValues` comes from
 * react-native-get-random-values, imported first in index.js.
 */
export function uuidv4(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, x => HEX[x]);
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h
    .slice(8, 10)
    .join('')}-${h.slice(10, 16).join('')}`;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const uuidGenerator: IdGenerator = { next: uuidv4 };
