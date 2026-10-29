-- ============================================================================
-- AegisLedger Database Schema
-- Production-Grade Double-Entry Bookkeeping Ledger
-- Enforces Financial Invariants, Append-Only Mutability, and Strict Concurrency
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- Accounts Table
-- Chart of Accounts representing financial balance states
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(32) NOT NULL CHECK (type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
    currency VARCHAR(5) NOT NULL,
    balance BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'FROZEN', 'CLOSED')),
    allow_negative_balance BOOLEAN NOT NULL DEFAULT FALSE,
    version INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_code ON accounts(code);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);

-- ----------------------------------------------------------------------------
-- Transactions Table (Journal Header)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    type VARCHAR(32) NOT NULL DEFAULT 'STANDARD' CHECK (type IN ('STANDARD', 'REVERSAL')),
    status VARCHAR(32) NOT NULL DEFAULT 'POSTED' CHECK (status IN ('DRAFT', 'POSTED', 'REVERSED')),
    description TEXT NOT NULL,
    reverses_transaction_id UUID REFERENCES transactions(id) ON DELETE RESTRICT,
    posted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_idempotency ON transactions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_transactions_posted_at ON transactions(posted_at);

-- ----------------------------------------------------------------------------
-- Entries Table (Journal Lines) - STRICTLY APPEND-ONLY (Create & Read)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    direction VARCHAR(16) NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
    amount BIGINT NOT NULL CHECK (amount > 0),
    sequence INT NOT NULL CHECK (sequence >= 0),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entries_account_created ON entries(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_transaction ON entries(transaction_id);

-- Enforce strict append-only at the database engine level (Never UPDATE or DELETE entries)
CREATE OR REPLACE FUNCTION prevent_entry_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'AegisLedger Violation: Financial entries are strictly append-only and cannot be updated or deleted. Transaction ID: %, Entry ID: %', OLD.transaction_id, OLD.id;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_entry_update ON entries;
CREATE TRIGGER trg_prevent_entry_update
BEFORE UPDATE OR DELETE ON entries
FOR EACH ROW
EXECUTE FUNCTION prevent_entry_mutation();

-- ----------------------------------------------------------------------------
-- Idempotency Keys Table
-- Guarantees exactly-once processing for distributed clients
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key VARCHAR(255) PRIMARY KEY,
    request_hash VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED')),
    response_payload JSONB,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    error_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);
