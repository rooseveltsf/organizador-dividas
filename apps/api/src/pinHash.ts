import { createHmac, scrypt, timingSafeEqual } from 'node:crypto';

export function pinKey(pin: string, salt: Buffer, secret: Buffer): Promise<Buffer> {
  const keyedPin = createHmac('sha256', secret).update(pin).digest();
  return new Promise((resolve, reject) => {
    scrypt(keyedPin, salt, 32, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function matchesPinHash(pin: string, expectedHash: string, secret: Buffer) {
  const stored = /^scrypt-v1:([0-9a-f]{32}):([0-9a-f]{64})$/.exec(expectedHash);
  if (!stored) throw new Error('Formato de hash inválido.');
  const actual = await pinKey(pin, Buffer.from(stored[1], 'hex'), secret);
  return timingSafeEqual(actual, Buffer.from(stored[2], 'hex'));
}
