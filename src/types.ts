/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  password_hash: string;
  role: UserRole;
  is_verified: boolean;
  age_verified: boolean;
  is_banned: boolean;
  created_at: string;
  updated_at: string;
}

export interface Wallet {
  id: number;
  user_id: number;
  balance: number; // Stored in virtual coins
  created_at: string;
  updated_at: string;
}

export type TransactionType = 'bet' | 'win' | 'adjustment';
export type TransactionStatus = 'completed' | 'failed' | 'pending';

export interface Transaction {
  id: number;
  user_id: number;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  reference_note?: string;
  created_at: string;
}

export interface GameRound {
  id: number;
  user_id: number;
  game_type: 'limbo';
  server_seed: string;
  server_seed_hash: string;
  client_seed: string;
  nonce: number;
  result_multiplier: number;
  bet_amount: number;
  win: boolean;
  created_at: string;
}

export interface GameHistory {
  id: number;
  table_id: string;
  game_type: 'rummy' | 'poker';
  players: any; // JSON representation of player names/IDs
  winner_user_id?: number | null;
  bet_amount: number;
  result_data: any; // JSON containing hands, actions, cards
  created_at: string;
}

export interface CurrencyRate {
  id: number;
  currency_code: string;
  rate: number;
  updated_at: string;
}

export interface GameTable {
  id: string;
  game_type: 'rummy' | 'poker';
  players: {
    user_id: number;
    name: string;
    cards: string[];
    is_folded: boolean;
    is_declared: boolean;
    chips_bet: number;
  }[];
  deck: string[];
  discard_pile: string[];
  pot: number;
  state: 'waiting' | 'playing' | 'completed';
  current_turn_index: number;
  winner_id?: number | null;
  created_at: string;
}
