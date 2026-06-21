# AuraPost AI - Import Ingestion System Lifecycle Diagram

This text-based UML and sequence architecture document traces the lifetime of automated product ingestion actions inside the AuraPost Node.js ecosystem.

---

## 1. Sequence Ingestion Diagram

The complete end-to-end operation tracing parallel client validations, async queuing, Residential IP rotations, evaluation parsing, and finalized account ledger updates.

```
 Client API              Gateway Router     Ingestion Queue     Residential Proxy     Parser Engine       DB / Storage
   (UI)                   (Auth/Quota)         (BullMQ)            (Oxylabs/IP)        (Sharp/DOM)          (Postgres)
    │                          │                  │                     │                   │                    │
    │  POST /import-product    │                  │                     │                   │                    │
    ├─────────────────────────►│                  │                     │                   │                    │
    │  [Payload: URL, ProjID]  │                  │                     │                   │                    │
    │                          │                  │                     │                   │                    │
    │                          ├─── Verify Auth   │                     │                   │                    │
    │                          │    and Token     │                     │                   │                    │
    │                          │                  │                     │                   │                    │
    │                          ├─── Ensure Quota  │                     │                   │                    │
    │                          │    Balance >= 20 │                     │                   │                    │
    │                          │                  │                     │                   │                    │
    │                          ├─── Push Ingest Task ──────────────────►│                   │                    │
    │                          │    [Task Status: Initialized]          │                   │                    │
    │                          │                  │                     │                   │                    │
    │    202 Accepted          │                  │                     │                   │                    │
    │◄─────────────────────────┤                  │                     │                   │                    │
    │                          │                  │                     │                   │                    │
    │                          │                  │─── Fetch Task ─────►│                   │                    │
    │                          │                  │    (Worker Thread)  │                   │                    │
    │                          │                  │                     │                   │                    │
    │                          │                  │                     ├── Pull Target URL │                    │
    │                          │                  │                     │   w/ Spoofed UA   │                    │
    │                          │                  │                     ├──────────────────►│                    │
    │                          │                  │                     │                   │                    │
    │                          │                  │                     │◄── Return DOM     │                    │
    │                          │                  │                     │    (HTML/JSON-LD) │                    │
    │                          │                  │                     │                   │                    │
    │                          │                  │                     │                   ├── Parse Variants,  │
    │                          │                  │                     │                   │   Price & Specs    │
    │                          │                  │                     │                   ├─────────────────┐  │
    │                          │                  │                     │                   │                 │  │
    │                          │                  │                     │                   │◄────────────────┘  │
    │                          │                  │                     │                   │                    │
    │                          │                  │                     │                   ├── WebP Convert &   │
    │                          │                  │                     │                   │   Upload Media     │
    │                          │                  │                     │                   ├───────────────────────► [S3 Bucket]
    │                          │                  │                     │                   │                        │
    │                          │                  │                     │                   ├── Enforce Strict       │
    │                          │                  │                     │                   │   Normal JSON Schema   │
    │                          │                  │                     │                   ├─────────────────┐      │
    │                          │                  │                     │                   │                 │      │
    │                          │                  │                     │                   │◄────────────────┘      │
    │                          │                  │                     │                   │                        │
    │                          │                  │                     │                   ├── Commit Normalized ──► [Postgres]
    │                          │                  │                     │                   │   Records Transaction  │ (normalized_products)
    │                          │                  │                     │                   │                        │
    │                          │                  │                     │                   ├── Debit 20 Credits ───► [Postgres]
    │                          │                  │                     │                   │   (Ledger Insert)      │ (credit_ledger)
    │                          │                  │                     │                   │                        │
    │                          │                  │◄── Job Complete ────┴───────────────────┤                        │
    │                          │                  │    (Update Status: Completed)           │                        │
    │                          │                  │                                         │                        │
```

---

## 2. Platform Scraper Routing Trees

```
                  [Import Ingest Task Initiated]
                                │
                  ┌─────────────┴─────────────┐
                  ▼                           ▼
        [Is URL Valid?]             [Is User Account Quota Checked?]
                  │                           │
          ┌───────┴───────┐           ┌───────┴───────┐
          ▼               ▼           ▼               ▼
       [No]             [Yes]       [No]            [Yes]
          │               │           │               │
  (Abort Client)          │    (Throw 402 Error)      │
                          ▼                           ▼
               [Detect Targeting Source Domain]       │
                               │                      │
       ┌───────────┬───────────┼───────────┬──────────┘
       ▼           ▼           ▼           ▼
   [Shopify]    [Amazon]   [WooCommerce] [AliExpress / Alibaba]
       │           │           │           │
       │           │           │           └──► Inject spoofed state variable
       │           │           │                `window.runParams` emulator
       │           │           │
       │           │           └──► Parse JSON-LD metadata or
       │           │                query REST standard `/wp-json/wc/v3`
       │           │
       │           └──► Emulate browser headers, extract Microdata (Schema.org),
       │                parse `span#productTitle` element maps
       │
       └──► Append standard product handle with `.json` suffix, 
            bypass frontends to parse raw nested Shopify catalog elements
```

---

## 3. Queue Handling & Circuit Breakdown

```
        Worker Picks BullMQ Ingestion Job
                       │
                       ▼
          [Initialize Proxy Handshake]
                       │
                       ▼
           [Perform Fetch Resource Session] ◄──────────────────────┐
                       │                                           │
             ┌─────────┴─────────┐                                 │ No (Retry up to 3x)
             ▼                   ▼                                 │
         [Succeed?]           [Fail / Cloudflare Wall?]            │
             │                   │                                 │
             │                   ▼                                 │
             │            [Attempts < 3?] ─────────────────────────┘
             │                   │
             │                   └── No (Circuit Breach / Abandonment)
             │                           │
             │                           ▼
             │                    Log Exception Trace
             │                    Write Status "Failed"
             │                    Notify Slack Alert
             │
             ▼
      Normalized parsing mapping runs
      Assert valid attributes matching standardized formats
      Convert product images utilizing Sharp
      Upload to Cloud CDN Asset host
      Commit Transactional DB Writes & Credit Deduction Ledger (20 tokens)
```
