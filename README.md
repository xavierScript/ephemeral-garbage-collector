# Ephemeral Garbage Collector 🗑️✨

A Solana Anchor program demonstrating the integration of **MagicBlock Ephemeral Rollups** with the **TukTuk Decentralized Automation Engine** to create an automated, permissionless garbage collection system for temporary L2 state accounts.

## 🌟 Overview

When building fast-paced on-chain games or high-throughput applications using Ephemeral Rollups, user state accounts can often be abandoned or left idle. This project solves that problem by introducing a **Decentralized Garbage Collector**.

It tracks the `last_active` timestamp of a delegated user account. Once an account exceeds the inactivity threshold (e.g., 60 seconds), TukTuk's decentralized network of "crankers" is authorized to securely burn the account, wipe the data from the blockchain, and refund the rent (lamports) back to the original owner.

## 🚀 Core Features

- **Ephemeral State Delegation:** Seamlessly move L1 state accounts to MagicBlock Ephemeral Rollups for high-speed, zero-fee updates.
- **Trustless Garbage Collection:** A decentralized task queue schedules background sweeps for abandoned accounts.
- **Secure Threshold Constraints:** Custom Anchor constraints (`NotOldEnough`) ensure crankers cannot maliciously close accounts that are still actively being used.
- **Permissionless Cranking:** The `CrankClose` instruction requires no signatures from the original user, allowing third-party automation networks to perform the cleanup.

## 📋 Prerequisites

Ensure you have the following installed:
- [Solana CLI](https://docs.solanalabs.com/cli/install) (configured for Devnet)
- [Anchor CLI](https://www.anchor-lang.com/docs/installation)
- Node.js & Yarn
- [TukTuk CLI](https://github.com/helium/tuktuk) (for creating Task Queues)

## 🛠️ Getting Started

### 1. Build and Deploy
Build the Anchor program and deploy it to Solana Devnet.
```bash
anchor build
anchor deploy --provider.cluster devnet
```

### 2. Setup your TukTuk Task Queue
Create a decentralized Task Queue on Devnet to handle your garbage collection tasks.
```bash
tuktuk -u https://api.devnet.solana.com task-queue create --name er-magic-queue --capacity 10 --funding-amount 100000000 --min-crank-reward 1000001 --stale-task-age 86400
```
*Note: Replace the `taskQueue` public key in `tests/er-state-account.ts` and `cron/cron.ts` with the output from this command.*

### 3. Run Integration Tests
The test suite performs a full lifecycle simulation: Initialization -> MagicBlock Delegation -> Ephemeral Updates -> TukTuk Task Scheduling -> 60-Second Wait Simulation -> Successful Garbage Collection.
```bash
yarn install
yarn run ts-mocha -p ./tsconfig.json -t 1000000 'tests/**/*.ts'
```

### 4. Start the Background Cron Job
You can run the cron script to perpetually schedule automated background checks via TukTuk.
```bash
npx ts-node cron/cron.ts --cronName "my-gc-cron" --queueName "er-magic-queue" --rpcUrl "https://api.devnet.solana.com"
```

## 🔐 Security Considerations
Before deploying to Mainnet, ensure the hardcoded `address` constraints inside the CPI scheduling logic (`schedule_close.rs`) are strictly bound to your authorized program/admin wallets to prevent malicious actors from spamming your Task Queue.
