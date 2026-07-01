/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';

// Card suits and ranks
export const SUITS = ['h', 'd', 'c', 's']; // hearts, diamonds, clubs, spades
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

/**
 * Creates and shuffles a standard 52-card deck using cryptographically secure random indexes.
 */
export function createAndShuffleDeck(): string[] {
  const deck: string[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(`${rank}${suit}`);
    }
  }

  // Fisher-Yates cryptographically secure shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const temp = deck[i];
    deck[i] = deck[j];
    deck[j] = temp;
  }

  return deck;
}

/**
 * Returns a human-readable card representation.
 */
export function formatCard(card: string): string {
  const rankMap: { [key: string]: string } = {
    'T': '10', 'J': 'Jack', 'Q': 'Queen', 'K': 'King', 'A': 'Ace'
  };
  const suitMap: { [key: string]: string } = {
    'h': 'Hearts', 'd': 'Diamonds', 'c': 'Clubs', 's': 'Spades'
  };
  const rank = card[0];
  const suit = card[1];
  return `${rankMap[rank] || rank} of ${suitMap[suit]}`;
}

/**
 * Simplified 5-card Poker hand evaluator that returns a numerical score and hand name.
 * Higher score = better hand.
 */
export function evaluatePokerHand(cards: string[]): { score: number; name: string } {
  if (cards.length < 5) return { score: 0, name: 'Invalid Hand' };

  const parsed = cards.slice(0, 5).map(c => {
    const rank = c[0];
    const suit = c[1];
    const value = RANKS.indexOf(rank) + 2; // 2-14
    return { rank, suit, value };
  });

  // Sort values descending
  parsed.sort((a, b) => b.value - a.value);

  const values = parsed.map(c => c.value);
  const suits = parsed.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);
  
  // Check for straight (handle Ace-low straight too)
  let isStraight = false;
  let straightHighValue = values[0];
  
  const uniqueValues = Array.from(new Set(values));
  if (uniqueValues.length === 5) {
    if (values[0] - values[4] === 4) {
      isStraight = true;
    } else if (values[0] === 14 && values[1] === 5 && values[2] === 4 && values[3] === 3 && values[4] === 2) {
      isStraight = true;
      straightHighValue = 5; // Five-high straight
    }
  }

  // Count frequencies of values
  const counts: { [key: number]: number } = {};
  for (const v of values) {
    counts[v] = (counts[v] || 0) + 1;
  }

  const freq = Object.values(counts).sort((a, b) => b - a);
  const freqPairs = Object.entries(counts).map(([val, cnt]) => ({
    val: parseInt(val, 10),
    cnt
  })).sort((a, b) => b.cnt - a.cnt || b.val - a.val);

  // Scores bases: Royal Flush = 900, Straight Flush = 800, 4 of Kind = 700,
  // Full House = 600, Flush = 500, Straight = 400, 3 of Kind = 300,
  // Two Pair = 200, Pair = 100, High Card = 0.
  
  if (isFlush && isStraight) {
    if (straightHighValue === 14) {
      return { score: 900, name: 'Royal Flush' };
    }
    return { score: 800 + straightHighValue, name: 'Straight Flush' };
  }

  if (freq[0] === 4) {
    return { score: 700 + freqPairs[0].val, name: `Four of a Kind (${formatValuePlural(freqPairs[0].val)})` };
  }

  if (freq[0] === 3 && freq[1] === 2) {
    return { score: 600 + freqPairs[0].val, name: `Full House (${formatValuePlural(freqPairs[0].val)} over ${formatValuePlural(freqPairs[1].val)})` };
  }

  if (isFlush) {
    return { score: 500 + values[0], name: 'Flush' };
  }

  if (isStraight) {
    return { score: 400 + straightHighValue, name: 'Straight' };
  }

  if (freq[0] === 3) {
    return { score: 300 + freqPairs[0].val, name: `Three of a Kind (${formatValuePlural(freqPairs[0].val)})` };
  }

  if (freq[0] === 2 && freq[1] === 2) {
    return { score: 200 + freqPairs[0].val * 1.5 + freqPairs[1].val * 0.1, name: `Two Pair (${formatValue(freqPairs[0].val)} and ${formatValue(freqPairs[1].val)})` };
  }

  if (freq[0] === 2) {
    return { score: 100 + freqPairs[0].val, name: `One Pair of ${formatValuePlural(freqPairs[0].val)}` };
  }

  return { score: values[0], name: `High Card (${formatValue(values[0])})` };
}

function formatValue(val: number): string {
  const map: { [key: number]: string } = { 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' };
  return map[val] || val.toString();
}

function formatValuePlural(val: number): string {
  const map: { [key: number]: string } = { 11: 'Jacks', 12: 'Queens', 13: 'Kings', 14: 'Aces', 6: 'Sixes' };
  return map[val] || `${val}s`;
}
