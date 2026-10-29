# AegisLedger: Enterprise Double-Entry Financial Engine

AegisLedger is a production-grade, enterprise-ready Double-entry Bookkeeping & Financial Ledger Engine built strictly according to **Clean Architecture** (Hexagonal / Ports & Adapters) principles.

Designed for high-throughput fintech platforms, banking cores, and payment processors where data integrity, auditability, strict concurrency control, and zero precision loss are mission-critical.

---

## 🏛️ Core Architectural Philosophies

### 1. Clean & Hexagonal Architecture (Ports and Adapters)
- **Domain Independence**: The Domain (`src/ledger/domain/`) is 100% pure TypeScript. It has zero dependencies on databases, web frameworks (Fastify), ORMs, or Node.js runtime specifics.
- **Dependency Rule**: Source code dependencies point strictly inward toward higher-level business policies:
  `Delivery (HTTP / REST) ➔ Use Cases ➔ Domain Entities & Value Objects 🠔 Infrastructure (PostgreSQL)`
- **Database is a Detail**: Database operations are declared as pure domain interfaces/ports (`ILedgerRepository`, `IUnitOfWork`, `IIdempotencyStore`) inside the use-case layer and fulfilled by raw SQL adapters in the infrastructure layer.

### 2. Package by Component
Code is organized horizontally around business components (`src/ledger/...`, `src/common/...`, `src/main/...`) rather than horizontal tech layers (`controllers/`, `services/`, `models/`).

### 3. Pure Double-Entry Bookkeeping & Financial Invariants
- **Conservation of Money**: Every transaction contains $\ge 2$ entries. For every currency:
  $$\sum \text{Debits} = \sum \text{Credits}$$
- **Strictly Append-Only**: Entries and transactions are Create & Read (CR) only. No `UPDATE` or `DELETE` is ever executed against ledger records.
- **Database Trigger Defense**: PostgreSQL triggers (`trg_prevent_entry_update`) actively abort any accidental or malicious direct SQL modifications on `entries`.
- **Reversal Transactions**: Corrections are achieved exclusively through mirror-reversal transactions that invert entry legs while establishing an audit link back to the original transaction ID.
- **Zero Floating-Point Drift**: Prohibits IEEE-754 floating point numbers for financial balance tracking. All currency calculations use exact integer minor units (e.g. cents, satoshis) via native `bigint` encapsulated in the `Money` Value Object.

### 4. Distributed Concurrency & Deadlock Prevention
- **Pessimistic Locking**: Concurrent balance mutations lock account rows using `SELECT ... FOR UPDATE`.
- **Canonical Lock Ordering (Deadlock Elimination)**: To prevent cyclic wait conditions when two transactions concurrently transfer money between the same accounts in opposite directions ($A \to B$ and $B \to A$), account IDs are sorted alphanumerically (`ORDER BY id ASC`) before acquiring locks.
- **Idempotency Guarantee**: Every mutating request requires an `Idempotency-Key` header with atomic deduplication and caching of execution results.

---

## 📁 Directory Structure

```text
aegis-ledger/
├── .github/
│   └── workflows/
│       └── ci.yml                 # GitHub Actions pipeline (lint, unit, integration)
├── docker-compose.yml             # Tuned PostgreSQL 16 Alpine + Ledger Service
├── Dockerfile                     # Multi-stage minimal production container
├── package.json                   # Scripts, TypeScript, Fastify, pg, Vitest
├── tsconfig.json                  # Strict TypeScript compiler options
├── vitest.config.ts               # Test runner configuration
├── .env.example                   # Environment variable template
├── README.md                      # Architecture, schema, and API documentation
├── src/
│   ├── common/                    # Shared enterprise kernel
│   │   ├── domain/
│   │   │   ├── result.ts          # Functional Result<T, E> monad
│   │   │   ├── value-object.ts    # Base ValueObject with structural equality
│   │   │   ├── entity.ts          # Base Entity with identity equality
│   │   │   └── aggregate-root.ts  # Base AggregateRoot with Domain Events
│   │   └── errors/
│   │       └── domain-error.base.ts
│   ├── ledger/                    # Core Ledger Component
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   ├── account.entity.ts      # Chart of accounts (Asset, Liability, Equity, etc.)
│   │   │   │   ├── entry.entity.ts        # Immutable Journal entry line (Debit / Credit)
│   │   │   │   └── transaction.entity.ts  # Aggregate Root enforcing double-entry invariants
│   │   │   ├── value-objects/
│   │   │   │   ├── money.vo.ts            # BigInt minor-units, Largest Remainder allocation
│   │   │   │   └── currency.vo.ts         # ISO-4217 currency specification
│   │   │   └── exceptions/
│   │   │       └── ledger.exceptions.ts   # Unbalanced, InsufficientFunds, Frozen, etc.
│   │   ├── usecases/
│   │   │   ├── ports/
│   │   │   │   ├── ledger-repository.port.ts
│   │   │   │   ├── unit-of-work.port.ts
│   │   │   │   └── idempotency-store.port.ts
│   │   │   ├── dtos/
│   │   │   │   ├── post-transaction.dto.ts
│   │   │   │   ├── get-balance.dto.ts
│   │   │   │   └── reverse-transaction.dto.ts
│   │   │   ├── post-transaction.usecase.ts
│   │   │   ├── get-balance.usecase.ts
│   │   │   └── reverse-transaction.usecase.ts
│   │   ├── infrastructure/
│   │   │   ├── database/
│   │   │   │   ├── migrations/
│   │   │   │   │   └── 001_init_ledger_schema.sql  # Pure SQL schema & append-only triggers
│   │   │   │   ├── postgres-pool.ts                # pg.Pool lifecycle management
│   │   │   │   └── migrate.ts                      # Standalone migration executor
│   │   │   └── persistence/
│   │   │       ├── postgres-ledger.repository.ts   # Pure SQL with canonical row locking
│   │   │       ├── postgres-unit-of-work.ts        # ACID boundary management
│   │   │       └── postgres-idempotency.repository.ts
│   │   └── delivery/
│   │       ├── http/
│   │       │   ├── transaction.controller.ts
│   │       │   └── transaction.router.ts
│   │       └── presenters/
│   │           └── ledger.presenter.ts             # Standardized API response format
│   └── main/
│       ├── config/
│       │   └── env.config.ts      # Type-safe Zod runtime configuration
│       ├── app.ts                 # Composition Root (Dependency Injection wiring)
│       └── server.ts              # Fastify bootstrap and graceful shutdown hooks
└── tests/
    ├── unit/
    │   ├── domain/                # Invariant checks: Money, Account, Transaction
    │   └── usecases/              # PostTransaction with In-Memory stubs
    ├── integration/               # Full HTTP router and controller lifecycle
    └── concurrency/               # 50 simultaneous opposing transfers (conservation of money)
```

---

## 🚀 Quick Start

### 1. Environment Configuration
```bash
cp .env.example .env
```

### 2. Launch with Docker Compose (Recommended)
This starts PostgreSQL 16 and AegisLedger API server:
```bash
docker compose up --build
```

### 3. Local Development (Node.js 20+)
```bash
# Install dependencies
npm install

# Run static type check
npm run typecheck

# Run test suite (Unit, Integration, Concurrency)
npm test

# Run migrations (Requires running Postgres)
npm run migrate

# Start development server with live reload
npm run dev
```

---

## 🧪 Verification & Test Suites

The test suite covers full domain invariants, use-case orchestration, HTTP routing, and race condition defense:

```bash
npm run test:unit         # Validates Money, Transaction, Account & In-Memory Use Cases
npm run test:integration  # Tests Fastify HTTP routes, headers, schema validation
npm run test:concurrency  # Tests 50 parallel opposing transfers for deadlocks & conservation
```

---

## 📡 REST API Reference

### 1. Post a Double-Entry Transaction
**Endpoint**: `POST /v1/transactions`  
**Headers**: `Idempotency-Key: <unique-uuid-or-key>`

```bash
curl -X POST http://localhost:3000/v1/transactions \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d" \
  -d '{
    "description": "Customer invoice payment",
    "entries": [
      {
        "accountId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "direction": "DEBIT",
        "amount": "15000",
        "currency": "USD",
        "description": "Debit Operating Cash ($150.00)"
      },
      {
        "accountId": "c9a646d3-9c61-4cd7-9f59-533c32bd5317",
        "direction": "CREDIT",
        "amount": "15000",
        "currency": "USD",
        "description": "Credit Accounts Receivable ($150.00)"
      }
    ]
  }'
```

**Success Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "transactionId": "7f0980cf-f273-42e1-807e-75f82247fcf1",
    "idempotencyKey": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "status": "POSTED",
    "type": "STANDARD",
    "description": "Customer invoice payment",
    "postedAt": "2026-10-28T13:30:00.000Z",
    "entries": [
      {
        "id": "e305e55b-42b7-4dbe-a1c2-3e284a1e9481",
        "accountId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "direction": "DEBIT",
        "amount": "15000",
        "currency": "USD",
        "sequence": 0,
        "description": "Debit Operating Cash ($150.00)"
      },
      {
        "id": "d140e90c-0d35-433c-8515-e23438f4d99c",
        "accountId": "c9a646d3-9c61-4cd7-9f59-533c32bd5317",
        "direction": "CREDIT",
        "amount": "15000",
        "currency": "USD",
        "sequence": 1,
        "description": "Credit Accounts Receivable ($150.00)"
      }
    ]
  },
  "timestamp": "2026-10-28T13:30:00.000Z"
}
```

---

### 2. Reverse a Transaction (Append-Only Reversal)
**Endpoint**: `POST /v1/transactions/:id/reversal`  
**Headers**: `Idempotency-Key: <unique-uuid>`

```bash
curl -X POST http://localhost:3000/v1/transactions/7f0980cf-f273-42e1-807e-75f82247fcf1/reversal \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: rev-9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d" \
  -d '{
    "reason": "Payment issued by mistake to wrong vendor"
  }'
```

---

### 3. Get Account Balance
**Endpoint**: `GET /v1/accounts/:id/balance`

```bash
curl http://localhost:3000/v1/accounts/f47ac10b-58cc-4372-a567-0e02b2c3d479/balance
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "accountId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "code": "1010",
    "name": "Operating Cash",
    "type": "ASSET",
    "currency": "USD",
    "balanceMinorUnits": "15000",
    "balanceFormatted": "150.00",
    "status": "ACTIVE",
    "version": 1,
    "updatedAt": "2026-10-28T13:30:00.000Z"
  },
  "timestamp": "2026-10-28T13:30:00.000Z"
}
```

---

## 🔒 Security & Concurrency Defense Summary

| Vector | Mitigation Strategy | Implementation Location |
| :--- | :--- | :--- |
| **Floating-Point Imprecision** | Integer minor units with `bigint` | [`Money`](src/ledger/domain/value-objects/money.vo.ts) |
| **Unbalanced Entries** | $\sum \text{Debits} \ne \sum \text{Credits}$ checks | [`Transaction`](src/ledger/domain/entities/transaction.entity.ts) |
| **Ledger Entry Tampering** | PostgreSQL `BEFORE UPDATE OR DELETE` trigger | [`001_init_ledger_schema.sql`](src/ledger/infrastructure/database/migrations/001_init_ledger_schema.sql) |
| **Deadlocks on Concurrent Transfers** | Canonical lock ordering (`ORDER BY id ASC FOR UPDATE`) | [`PostgresLedgerRepository`](src/ledger/infrastructure/persistence/postgres-ledger.repository.ts) |
| **Double-Spending** | Pessimistic Row Locking inside ACID Unit of Work | [`PostgresUnitOfWork`](src/ledger/infrastructure/persistence/postgres-unit-of-work.ts) |
| **Duplicate Requests (Network retries)**| Distributed idempotency store with status locking | [`PostgresIdempotencyRepository`](src/ledger/infrastructure/persistence/postgres-idempotency.repository.ts) |
