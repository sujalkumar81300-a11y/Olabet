-- ============================================================
-- SQL Schema Migrations for Gaming Platform (PostgreSQL/Supabase)
-- ============================================================

-- Create enum types if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('user', 'admin');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
        CREATE TYPE transaction_type AS ENUM ('bet', 'win', 'adjustment');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_status') THEN
        CREATE TYPE transaction_status AS ENUM ('completed', 'failed', 'pending');
    END IF;
END $$;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    password_hash VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'user'::user_role,
    is_verified BOOLEAN DEFAULT FALSE,
    age_verified BOOLEAN DEFAULT FALSE,
    is_banned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Wallets Table (One-to-One with Users)
CREATE TABLE IF NOT EXISTS wallets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    balance INTEGER DEFAULT 1000 NOT NULL CHECK (balance >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Transactions Ledger Table
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type transaction_type NOT NULL,
    amount INTEGER NOT NULL CHECK (amount >= 0),
    status transaction_status DEFAULT 'completed'::transaction_status,
    reference_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Game Rounds Table (Limbo rounds)
CREATE TABLE IF NOT EXISTS game_rounds (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    game_type VARCHAR(50) DEFAULT 'limbo',
    server_seed VARCHAR(255) NOT NULL,
    server_seed_hash VARCHAR(255) NOT NULL,
    client_seed VARCHAR(255) NOT NULL,
    nonce INTEGER NOT NULL,
    result_multiplier NUMERIC(10, 2) NOT NULL,
    bet_amount INTEGER NOT NULL,
    win BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Game Histories Table (Rummy/Poker completed games)
CREATE TABLE IF NOT EXISTS game_histories (
    id SERIAL PRIMARY KEY,
    table_id VARCHAR(100) NOT NULL,
    game_type VARCHAR(50) NOT NULL,
    players JSONB NOT NULL,
    winner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    bet_amount INTEGER NOT NULL,
    result_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Currency Rates Table (Exchange Rates Display)
CREATE TABLE IF NOT EXISTS currency_rates (
    id SERIAL PRIMARY KEY,
    currency_code VARCHAR(10) UNIQUE NOT NULL,
    rate NUMERIC(15, 6) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index creation for optimization
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_game_rounds_user_id ON game_rounds(user_id);
CREATE INDEX IF NOT EXISTS idx_game_histories_table_id ON game_histories(table_id);

-- Insert Default Admin User (seed)
-- Password is 'admin123'
INSERT INTO users (name, email, password_hash, role, is_verified, age_verified, is_banned)
VALUES (
    'Admin Operator',
    'admin@gaming.com',
    '$2b$10$vtP/AzS8uOUbROwk7cD7B.ptJKTAiQPY7Ubobjt0yjjVsdnC8frV6',
    'admin',
    TRUE,
    TRUE,
    FALSE
) ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

-- Seed Admin Wallet
INSERT INTO wallets (user_id, balance)
SELECT id, 100000 FROM users WHERE email = 'admin@gaming.com'
ON CONFLICT (user_id) DO NOTHING;
