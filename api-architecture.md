# AuraPost AI - Production-Ready API Architecture Blueprint

This document sets out the structural API definitions, payload schemas, headers, authorization mechanisms, and endpoint behaviors for the **AuraPost AI** server-side engine.

All requests are assumed to pass through an API gateway layer that handles SSL termination, rate-limiting, and standard CORS checks.

---

## 1. Gateway & Authentication Specifications

### Base URL
*   **Production API**: `https://api.aurapost.ai/v1`
*   **Sandbox/Internal**: `http://localhost:3000/api`

### Global Request Headers
```http
Content-Type: application/json
Accept: application/json
Authorization: Bearer <JWT_TOKEN_HERE>
X-Workspace-ID: <UUID_ACTIVE_WORKSPACE>
```

### Authorization Flow
AuraPost uses standard stateless JWT authentications token. The cryptographic payload includes:
*   `sub`: The unique authenticated user ID.
*   `email`: User's primary email.
*   `role`: Associated tenant role (e.g. `owner`, `member`).
*   `workspaces`: An array of associated UUIDs that the user has verified membership to query.

If the passed `X-Workspace-ID` matches an element within the token’s workspaces array, access is permitted, otherwise an immediate `403 Forbidden` response is asserted.

---

## 2. API Endpoint Resource Maps

### 2.1 Authentication & Workspace Switch APIs
Manages the user session mapping and active workspace switches.

#### `POST /auth/session/verify`
*   **Objective**: Exchange identity provider JWT elements or login state parameters to resolve active session characteristics.
*   **Request Payload**:
    ```json
    {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
    ```
*   **Response (200 OK)**:
    ```json
    {
      "success": true,
      "user": {
        "id": "usr_99f2a2ba-acc9-478a-9e12-cb5da2ee1824",
        "email": "youceftalamali@gmail.com",
        "fullName": "Youcef Talamali",
        "activeWorkspace": {
          "id": "ws_1a0da1b8-20dd-4fc4-8e11-1c0da1e82bb2",
          "name": "AuraPost HQ",
          "slug": "aurapost-hq"
        }
      }
    }
    ```

#### `POST /workspaces/{workspace_id}/switch`
*   **Objective**: Instructs the state to update active workspace context for the current session.
*   **Response (200 OK)**:
    ```json
    {
      "success": true,
      "activeWorkspaceId": "ws_1a0da1b8-20dd-4fc4-8e11-1c0da1e82bb2",
      "creditsBalance": 250
    }
    ```

---

### 2.2 Projects Campaign APIs
Manages the separate multi-tenant logical namespace structures.

#### `GET /projects`
*   **Objective**: Retrieve filtered active campaign projects matching physical workspace isolation borders.
*   **Response (200 OK)**:
    ```json
    {
      "data": [
        {
          "id": "proj_55b211a7-f273-455b-abb2-990da761cbcf",
          "name": "Q3 High-Ticket Travel Launch",
          "description": "Direct-to-consumer travel gear aiming at remote workers.",
          "createdAt": "2026-06-10T11:00:00Z",
          "updatedAt": "2026-06-14T14:14:00Z",
          "productCount": 1
        }
      ]
    }
    ```

#### `POST /projects`
*   **Objective**: Provision a new unique project space within metadata boundaries.
*   **Request Payload**:
    ```json
    {
      "name": "Aesthetics Travel Luggage",
      "description": "Campaign targeting millennial weekend getaway demographics."
    }
    ```
*   **Response (201 Created)**:
    ```json
    {
      "success": true,
      "id": "proj_44a211b8-e110-455b-abb2-001da883cbaa",
      "createdAt": "2026-06-14T21:15:00Z"
    }
    ```

---

### 2.3 Product Catalog APIs
Performs standard CRUD manipulations on e-commerce product listings inside selected workspace projects.

#### `GET /projects/{project_id}/products`
*   **Objective**: Retrieve active ingested products associated within targeted project campaigns.
*   **Response (200 OK)**:
    ```json
    {
      "products": [
        {
          "id": "prod_88c728e9-ab83-4922-be12-2d0fa58eaeee",
          "name": "Tapered Aero Titanium Mug",
          "price": 49.00,
          "compareAt": 85.00,
          "currency": "USD",
          "category": "Travel Accessories & Gear",
          "tags": ["Minimalist", "Commute", "Titanium", "Coffee"],
          "images": ["https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&q=80&w=600"],
          "sourcePlatform": "shopify",
          "sourceUrl": "https://myshopify-store.com/products/aero-titanium-mug"
        }
      ]
    }
    ```

#### `POST /projects/{project_id}/products`
*   **Objective**: Manually register a product metadata listing when links are not parsed directly.
*   **Request Payload**:
    ```json
    {
      "name": "Ortho Lumbar Ergonomic Pillow",
      "description": "Conforming supporting memory cushion.",
      "price": 34.99,
      "currency": "USD",
      "category": "Workspace Health",
      "tags": ["Ergonomic", "Back Relief"],
      "images": ["https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&q=80&w=300"]
    }
    ```
*   **Response (201 Created)**:
    ```json
    {
      "success": true,
      "productId": "prod_77b311fc-ee10-40af-bf11-c990a0ffaaee"
    }
    ```

---

### 2.4 Multi-Source Product Ingestion (Import System)
Serverless proxies designed to aggregate raw payloads from target commercial catalogs.

#### `POST /import-product`
*   **Objective**: Trigger server-side parsing engine pipelines targeting specified URLs.
*   **Credit Allocation**: Deducts **20 Generation Credits** on success.
*   **Request Payload**:
    ```json
    {
      "projectId": "proj_55b211a7-f273-455b-abb2-990da761cbcf",
      "sourcePlatform": "shopify",
      "sourceUrl": "https://myshopify-store.com/products/aero-titanium-mug"
    }
    ```
*   **Response (200 OK)**:
    ```json
    {
      "success": true,
      "creditsDeducted": 20,
      "product": {
        "id": "prod_88c728e9-ab83-4922-be12-2d0fa58eaeee",
        "name": "Tapered Aero Titanium Mug",
        "description": "Ultra-insulated double-wall titanium coffee flask.",
        "price": 49.00,
        "images": ["https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format..."],
        "rawMetadata": {
          "vendor": "TitaniumCo",
          "inventoryQuantity": 140
        }
      }
    }
    ```

---

### 2.5 Product Marketing Intelligence APIs
Integrates directly with Gemini API server-side logic pathways to form complex performance intelligence indices.

#### `POST /intelligence/analyze`
*   **Objective**: Generates holistic marketing ratings (Overall scores, targets, triggers, objections).
*   **Credit Allocation**: Deducts **20 Generation Credits** on execution.
*   **Request Payload**:
    ```json
    {
      "productId": "prod_88c728e9-ab83-4922-be12-2d0fa58eaeee"
    }
    ```
*   **Response (200 OK)**:
    ```json
    {
      "success": true,
      "creditsDeducted": 20,
      "analysis": {
        "scores": {
          "overall": 85,
          "demand": 90,
          "competition": 60,
          "trend": 95,
          "profitability": 80
        },
        "reasoning": "High demand for portable commuting items continues to pace upwards with low direct competitor footprint.",
        "targetProfile": {
          "countries": ["US", "UK", "CA", "DE"],
          "audiences": ["Active remote workers", "High-frequency morning commuters"]
        },
        "tacticalMatrix": {
          "objections": [
            { "objection": "Price is overly premium", "angle": "Emphasize lifelong durability and direct cost offsets from paper cup savings" }
          ],
          "emotionalTriggers": ["Avoidance of workplace spill accidents", "Seeking design status signal indicators"]
        }
      }
    }
    ```

---

### 2.6 AI Content Copywriter Generation APIs
Server-side generation proxy utilizing Google GenAI SDK.

#### `POST /copywriting/generate`
*   **Objective**: Spin localized, direct-response structures across predefined creative metrics.
*   **Credit Allocation**: Deducts **10 Generation Credits** per localized batch run.
*   **Request Payload**:
    ```json
    {
      "productId": "prod_88c728e9-ab83-4922-be12-2d0fa58eaeee",
      "objectiveType": "Hooks & Ad Captions",
      "tone": "persuasive",
      "language": "Spanish"
    }
    ```
*   **Response (200 OK)**:
    ```json
    {
      "success": true,
      "creditsDeducted": 10,
      "copy": {
        "title": "Aero Titanium Cup High-Octane Spanish Hook Sets",
        "items": [
          "¿Cansado de derramar tu café en el teclado? Conoce la taza hecha para el ritmo acelerado del desarrollador.",
          "El titanio se encuentra con el café del mañana. 24 horas de temperatura garantizada sin fugas en tu mochila."
        ],
        "formattedHtml": "<h4>Spanish High-Converting Hooks</h4><ul><li>¿Cansado de derramar...</li></ul>"
      }
    }
    ```

---

### 2.7 Multi-Platform Dispatched Publishing APIs
Core dispatching engine routing scheduled social media payloads.

#### `POST /publishing/schedule`
*   **Objective**: Place a social post block on the cron dispatcher queue structure.
*   **Request Payload**:
    ```json
    {
      "projectId": "proj_55b211a7-f273-455b-abb2-990da761cbcf",
      "socialAccountId": "sa_e1a129ef-12cc-4911-adcb-1c990ff1e382",
      "platform": "instagram",
      "caption": "Minimalist form paired with maximum thermal velocity. ☕️🎒",
      "scheduledAt": "2026-06-15T09:00:00Z",
      "mediaUrls": ["https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format..."]
    }
    ```
*   **Response (201 Created)**:
    ```json
    {
      "success": true,
      "postId": "post_77c229ea-009c-4822-ba12-f1c99f0be822",
      "status": "scheduled"
    }
    ```

#### `GET /publishing/posts/calendar`
*   **Objective**: Retrieve visual calendar listing arrays of scheduled content logs.
*   **Response (200 OK)**:
    ```json
    {
      "posts": [
        {
          "id": "post_77c229ea-009c-4822-ba12-f1c99f0be822",
          "platform": "instagram",
          "caption": "Minimalist form...",
          "scheduledAt": "2026-06-15T09:00:00Z",
          "status": "scheduled"
        }
      ]
    }
    ```

---

### 2.8 Subscription Billing & Stripe Handlers
Processes payment tokens, manages active tiers, and coordinates purchases.

#### `POST /billing/stripe/checkout-session`
*   **Objective**: Open a Stripe-hosted payment tunnel session for subscription upgrades or token purchases.
*   **Request Payload**:
    ```json
    {
      "priceId": "price_1N2HJK32K8sd98uJ", -- Pro plan monthly link or one-time credit bundle ID
      "cancelUrl": "https://aurapost.ai/billing",
      "successUrl": "https://aurapost.ai/billing?session_id={CHECKOUT_SESSION_ID}"
    }
    ```
*   **Response (200 OK)**:
    ```json
    {
      "sessionId": "cs_test_a1r4tuy110aOPI99",
      "stripeRedirectUrl": "https://checkout.stripe.com/c/pay/cs_test_a1r4tuy110a..."
    }
    ```

#### `POST /billing/stripe/webhook`
*   **Objective**: Receive payment feedback to trigger credit allocations in the ledger.
*   **Headers Required**: `Stripe-Signature` (to prevent hook spoofing)
*   **Request Payload**: Standard Stripe Event JSON (e.g. `checkout.session.completed`, `customer.subscription.deleted`).
*   **Response (200 OK)**:
    ```json
    {
      "received": true,
      "action": "allocated_credits_1000",
      "workspaceId": "ws_1a0da1b8-20dd-4fc4-8e11-1c0da1e82bb2"
    }
    ```

---

## 3. Standard API Status & Error Contracts

AuraPost enforces uniform, structured developer error messages to minimize debug friction.

### Unauthorized Request (401 Unauthorized)
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Bearer credential token is either stale, omitted, or holds invalid cryptographic signatures."
  }
}
```

### Insufficient Generation Balance (402 Payment Required)
```json
{
  "error": {
    "code": "INSUFFICIENT_CREDITS",
    "message": "Your current workspace has a balance of 0 credits. Upgrade your active subscription plan on the billing tab to resume generations.",
    "workspaceId": "ws_1a0da1b8-20dd-4fc4-8e11-1c0da1e82bb2",
    "requiredCredits": 20,
    "availableCredits": 0
  }
}
```

### Validation Bounds Violated (422 Unprocessable Entity)
```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Validation constraints failed for fields supplied in raw request payload.",
    "details": [
      {
        "field": "sourceUrl",
        "issue": "Your provided URL is missing correct format prefix strings (http:// or https://)"
      }
    ]
  }
}
```
