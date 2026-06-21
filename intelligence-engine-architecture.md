# AuraPost AI - Product Intelligence Engine Architecture Specification

The **Product Intelligence Engine** serves as the primary analytical processor (the "Brain") of AuraPost AI. It executes high-dimensional marketplace opportunity scoring, marketing angle discovery, and creative copywriting strategy synthesis. It ingests standardized product records, coordinates multi-provider LLM pipelines, resolves model confidence levels, and persists revision histories under a strict credit-metered ledger.

---

## 1. System Pipeline & Service Abstraction

The engine operates on a decoupled multi-agent architecture. To guarantee continuous uptime and protect against rate limits, outages, or provider degradation, all LLM operations route through a unified **AI Provider Abstraction Layer**.

### 1.1 Decoupled Decider & Agent Pipeline Flow

```
[Standardized Product JSON] ──► [Analysis Worker Router]
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
     [Gemini Provider Client]                      [OpenAI Provider Client]
    (Primary: gemini-3.5-flash)                   (Fallback: gpt-4o-mini)
                │                                             │
                └──────────────────────┬──────────────────────┘
                                       ▼
                       [Dynamic Prompter Configuration]
                                       │
                ┌──────────────────────┼──────────────────────┐
                ▼                      ▼                      ▼
  [Phase 1: Market Intelligence] [Phase 2: Marketing Angles] [Phase 3: Creative Generation]
                │                      │                      │
                └──────────────────────┴───┬──────────────────┘
                                           ▼
                            [Validator & Parser Pipeline]
                                           │
                                  (JSON Schema Matches?)
                                    /              \
                                  Yes              No
                                  /                  \
                                 ▼                    ▼
                    [Output Persisted & Managed]   [Auto-Heal & Retry]
```

### 1.2 Provider Abstraction Specification
The system implements a generic TypeScript interface enabling seamless hot-swapping between Google GenAI and OpenAI APIs.

```typescript
export type AIProviderName = 'gemini' | 'openai';

export interface AIProviderConfig {
  apiKey: string;
  modelName: string;
  temperature: number;
  responseMimeType?: 'application/json';
}

export interface IngestionPromptMetadata {
  productId: string;
  language: string; // "en" | "es" | "fr" | "ar", etc.
  workspaceId: string;
}

export interface ProviderResponse {
  rawContent: string;
  provider: AIProviderName;
  modelUsed: string;
  tokensConsumed: {
    prompt: number;
    completion: number;
  };
  latencyMs: number;
}

export interface IAIProvider {
  generateStructuredJSON<T>(
    prompt: string,
    systemInstruction: string,
    schema: object,
    config: AIProviderConfig
  ): Promise<ProviderResponse>;
}
```

### 1.3 Adaptive Failover & Auto-Heal Strategy
1.  **Primary Routing**: All structured operations default to **Google GenAI (`gemini-3.5-flash`)** because of its high-speed processing, low token cost, and native schema compliance.
2.  **Fallback Triggering (Circuit Breaker)**: If Gemini experiences contiguous ratelimit hits (HTTP 429), server timeouts (HTTP 504), or internal errors (HTTP 500) totaling 3 failures in a 2-minute sliding timeframe, the router acts on a circuit-break trigger and immediately routes subsequent jobs to **OpenAI (`gpt-4o-mini`)**.
3.  **Output Auto-Healing**: If a provider returns invalid JSON schemas resulting in parser errors, the engine strips markdown code fences (e.g. ````json ... ````) and attempts to run a localized regex extraction. If it still fails, it launches a single, lightweight schema patching micro-call before failing the job.

---

## 2. Token Budgeting & Credit Isolation Flow

Market analysis operations consume system compute blocks. To prevent abuse and protect unit-economics, AuraPost exposes a robust, tamper-proof transactional credit balance model.

### 2.1 Credit Transaction Pipeline
-   **Operation Quota Cost**: A complete marketing intelligence report deducts a static **20 Credits** from the originating workspace ledger.
-   **Locking & Isolation (Atomicity)**:
    1.  The workspace requests `/api/intelligence/analyze`.
    2.  An atomic database transaction is initiated:
        ```sql
        SELECT credits_balance FROM workspace_billing WHERE id = $1 FOR UPDATE;
        ```
    3.  If `credits_balance < 20`, the transaction aborts instantly and outputs a `402 Payment Required` (code: `INSUFFICIENT_CREDITS`) error message.
    4.  If balance resides within limits, a temporary lock is asserted and **20 credits are frozen** in an output hold record.
    5.  The asynchronous ingestion task starts inside BullMQ.
    6.  If the task finishes successfully, the frozen lock releases and the 20 credits are committed as permanently decupled/debited.
    7.  If the task crashes permanently or fails validation checks, the lock rolls back, and credits refund instantly to the workspace's active pool, logging the traceback.

---

## 3. High-Fidelity API Schema Contracts

Our standardized JSON structures enforce uniform output bounds designed for downstream components (ad editors, automated content generators).

### `POST /api/v1/intelligence/analyze`

**Request Headers & Payload**:
```http
Authorization: Bearer <JWT_TOKEN_HERE>
X-Workspace-ID: ws_1a0da1b8-20dd-4fc4-8e11-1c0da1e82bb2
Content-Type: application/json
```
```json
{
  "productId": "prod_88c728e9-ab83-4922-be12-2d0fa58eaeee",
  "language": "es",
  "forceReanalyze": false
}
```

### Response Schema Standard (200 OK)
The output JSON consolidates Opportunity Metrics, Market Targets, Emotional Pain Points, and Copy Hooks.

```json
{
  "success": true,
  "analysisId": "anl_99a311db-ac34-40af-bf12-dd90f0ffa88e",
  "productId": "prod_88c728e9-ab83-4922-be12-2d0fa58eaeee",
  "version": 2,
  "language": "es",
  "confidenceScore": 0.94,
  "creditsDeducted": 20,
  "providerMetadata": {
    "providerName": "gemini",
    "modelName": "gemini-3.5-flash",
    "latencyMs": 1420
  },
  "marketData": {
    "opportunityScore": {
      "overall": 87,
      "demand": 92,
      "competition": 62,
      "trend": 95,
      "profitability": 80
    },
    "marketIntelligence": {
      "bestCountries": ["US", "MX", "ES", "CO"],
      "bestAudiences": [
        {
          "personaName": "Desarrollador Remoto Nómada",
          "rationale": "Alto ingreso disponible, alta prioridad en la portabilidad y diseño minimalista."
        }
      ],
      "bestAdPlatforms": [
        {
          "platform": "instagram",
          "format": "Reels / Video vertical corto",
          "justification": "Alto engagement visual en nichos de diseño de escritorios y minimalismo estético."
        }
      ],
      "suggestedPricing": {
        "msrp": 49.99,
        "lowestAestheticBound": 39.99,
        "premiumVibeBound": 79.99,
        "currency": "USD"
      }
    },
    "marketingIntelligence": {
      "benefits": [
        "Mantiene las bebidas heladas por 24 horas continuas gracias al aislamiento de doble pared de titanio."
      ],
      "objections": [
        {
          "objection": "El precio de $49 es elevado para una taza.",
          "refutationAngle": "Compare el gasto acumulado de vasos descartables vs un artículo indestructible de titanio con garantía perpetua."
        }
      ],
      "emotionalTriggers": [
        "El deseo de pertenencia al nicho del 'Minimal Tech Setups'",
        "Evitar accidentes destructivos de café caliente sobre teclados mecánicos costosos."
      ],
      "painPoints": [
        "Tazas de cerámica tradicionales que se rompen al transportarlas.",
        "Café frío de oficina insípido que interrumpe sesiones profundas de concentración."
      ],
      "sellingAngles": [
        "La última taza de viaje que comprarás en tu vida."
      ]
    },
    "creativeIntelligence": {
      "hooks": [
        "Deja de tirar dinero en vasos de café reciclables. Este envase de titanio durará más que tu computadora."
      ],
      "adConcepts": [
        {
          "conceptName": "El Test de Caída Extrema",
          "hookId": 0,
          "description": "Un video de 15 segundos donde la taza de titanio sobrevive intacta a caídas accidentales en un setup, en contraste con tazas de porcelana convencionales que estallan al primer impacto."
        }
      ],
      "ugcIdeas": [
        "Un creador de TikTok abriendo su mochila, mostrando como la taza de titanio cabe perfectamente entre cables, MacBooks y cámaras sin derramar una sola gota."
      ],
      "videoConcepts": [
        {
          "durationSeconds": 30,
          "visualFlow": "Toma macro de café caliente cayendo sobre el titanio cepillado de la taza. El humo sube suavemente. Corte a plano general del nómada terminando su código en una cafetería exterior.",
          "audioDialogue": "[Música lofi tranquila] 'Diseñado para durar. Hecho para crear. Aero Mug.'"
        }
      ]
    }
  },
  "analyzedAt": "2026-06-14T21:30:00Z"
}
```

---

## 4. Confidence Score Formula & Calculation

The overall Analysis Confidence Score ($C$) measures the statistical reliability of the computed data blocks, derived from the input metadata's volume and the provider structure.

$$C = (W_{img} \cdot I) + (W_{desc} \cdot D) + (W_{attr} \cdot A) + (W_{model} \cdot M)$$

Where:
-   $I \in [0, 1]$: Image availability score (0 if no images, 1 if rich product images exist).
-   $D \in [0, 1]$: Description completeness score ($0.1 + \min(\text{length of description}, 1000)/1000 \cdot 0.9$).
-   $A \in [0, 1]$: Structured attributes and specifications density.
-   $M \in [0, 1]$: Core LLM alignment parameters or active search tool grounding feedback.
-   $W_{img}, W_{desc}, W_{attr}, W_{model}$ represent standard normalized weight parameters ($W_{img} = 0.25$, $W_{desc} = 0.35$, $W_{attr} = 0.20$, $W_{model} = 0.20$, summing to $1.0$).

If $C < 0.5$, a warning flag is appended: `low_confidence_data = true`, advising the user to supply manual product tags to optimize accuracy.

---

## 5. Multi-Language Engine Mechanics

To support cross-border commerce localized for international platforms, the engine implements native translation schemas:

1.  **System Language Forcing**: The API takes a code parameter (`en`, `es`, `fr`, `de`, `ar`, `ja`).
2.  **Prompt Wrapping**: The prompting engine wraps the product's structured properties alongside localized cultural guidelines to prevent dry translate artifacts.
3.  **Literal vs. Creative Mapping**:
    -   *Market Targets / Countries & Price Suggested bounds* are calculated based on targeted destination markets.
    -   *Creative Hooks / Video Copy / UGC guidelines* are synthesized directly in the destination language capturing regional expressions, emojis, and local marketing slang.

---

## 6. Versioning, Re-analysis & Audit Trails

Product parameters change inside commercial catalogs, requiring real-time re-analysis. Our database model manages updates asynchronously:

1.  **Version Progression**: Each new evaluation increments the product's analysis version pointer (`version = current_version + 1`).
2.  **Immutability Matrix**: Historic reports are structured as immutable rows in `product_analyses`. We **NEVER** overwrite previous reports directly; this guarantees the consistency of generated content down the publishing pipeline.
3.  **Auditable Logs**: A central database audit history logs changes, model properties, times, raw outputs, and debited tokens.
