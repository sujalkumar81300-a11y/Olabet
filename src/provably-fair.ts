/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';

export interface ProvablyFairResult {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  resultMultiplier: number;
}

/**
 * Generates a strong random server seed and returns its SHA-256 hash.
 */
export function generateServerSeed(): { seed: string; hash: string } {
  const seed = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  return { seed, hash };
}

/**
 * Deterministically generates a game multiplier using SHA-256 and the seeds.
 */
export function calculateLimboMultiplier(serverSeed: string, clientSeed: string, nonce: number): number {
  const hash = crypto.createHash('sha256')
    .update(`${serverSeed}-${clientSeed}-${nonce}`)
    .digest('hex');
  
  // Convert first 8 characters (32-bit integer) to decimal
  const hexValue = hash.substring(0, 8);
  const intValue = parseInt(hexValue, 16);
  
  // Standard Bustabit/Limbo provably fair calculation:
  // 4294967295 is 2^32 - 1. We scale the percentage.
  // 1% house edge is applied by multiplying by 0.99.
  const maxVal = 4294967295;
  
  // Calculate multiplier, capped at 1.0 minimum and 1,000,000.0 maximum
  let multiplier = (maxVal / (intValue + 1)) * 0.99;
  
  // Round to two decimal places
  multiplier = Math.floor(multiplier * 100) / 100;
  
  return Math.max(1.0, Math.min(1000000.0, multiplier));
}
