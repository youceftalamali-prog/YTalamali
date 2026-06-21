# AuraPost AI - Product Import Engine Architecture Specification

The Product Import Engine ingest raw catalog arrays and unstructured DOM elements from Shopify feeds, Amazon, AliExpress, Alibaba, and WooCommerce, and transforms them into a clean, unified, database-ready e-commerce object model.

---

## 1. System Pipeline Overview

The import pipeline runs as a decoupled event-driven sequence triggered via `/api/v1/imports/product`.

```
[Target E-commerce URL] 
         │
         ▼
[1. Source Detector] ──► Extends Parser Class
         │
         ▼
[2. Proxy Rotator & Cookie Jar] ──► Stealth Headless Call (Crawlee/Puppeteer)
         │
         ▼
[3. Extraction Layer] ──► DOM/JSON Parser (Cheerio, raw JSON, microdata)
         │
         ▼
[4. Media Processor] ──► S3 download & WebP Converter
         │
         ▼
[5. Normalization Engine] ──► Unified Schema compliance mapping
         │
         ▼
[6. Database Persistence] ──► DB transaction & Credit debit trigger
```

---

## 2. Ingestion Deep Dive

### 2.1 Source Detection & URL Validation Engine
URLs are structured and matched against high-performance regular expressions inside the API Gateway middleware before any worker is spun up.

```typescript
export type PlatformSource = 'shopify' | 'amazon' | 'aliexpress' | 'alibaba' | 'woocommerce' | 'manual';

export interface ValidatedURL {
  isValid: boolean;
  source: PlatformSource;
  normalizedUrl: string;
}

export function validateAndDetectUrl(inputUrl: string): ValidatedURL {
  try {
    const parsed = new URL(inputUrl.trim());
    const hostname = parsed.hostname.toLowerCase();
    
    // Shopify stores can possess custom domains, so we must inspect headers later.
    // By default, we detect standard paths first.
    if (hostname.includes('amazon.') || hostname.includes('amzn.to')) {
      return { isValid: true, source: 'amazon', normalizedUrl: parsed.toString() };
    }
    if (hostname.includes('aliexpress.com')) {
      return { isValid: true, source: 'aliexpress', normalizedUrl: parsed.toString() };
    }
    if (hostname.includes('alibaba.com')) {
      return { isValid: true, source: 'alibaba', normalizedUrl: parsed.toString() };
    }
    if (hostname.includes('myshopify.com')) {
      return { isValid: true, source: 'shopify', normalizedUrl: parsed.toString() };
    }
    
    // Default fallback check is passed to the fetcher to inspect metadata (for WooCommerce or customized Shopify domains)
    return { isValid: true, source: 'shopify', normalizedUrl: parsed.toString() };
  } catch {
    return { isValid: false, source: 'manual', normalizedUrl: '' };
  }
}
```

### 2.2 Ingestion Protocols per Source
1.  **Shopify**: Rather than crawling heavy frontend script wrappers, the fetcher appends `.json` or `.oembed` payloads to the product path (e.g. `https://brand.com/products/the-mug.json`). If blocked, it pulls feed arrays from `/collections/all.atom` or uses GraphQL Storefront APIs.
2.  **Amazon**: Parses microdata block layouts (JSON-LD) or falls back to scraping key tags (`span#productTitle`, `div#priceInsideBuyBox_feature_div`, `div#imgTagWrapperId img`).
3.  **AliExpress / Alibaba**: Leverages mobile-optimized web views which output simplified script payloads, parsing nested configurations containing initial state elements like `window.runParams`.
4.  **WooCommerce**: Discovers target meta tags `generator` pointing to "WooCommerce" and leverages standard WordPress `/wp-json/wc/v3` endpoints or parses JSON-LD structures.

---

## 3. Product Extraction Specifications

### 3.1 Variant, Price & Inventory Extraction Matrix
*   **Price Normalization**: Currency is forced to standard ISO-4217 strings (e.g., `USD`, `EUR`, `AED`). All prices are normalized into decimal numerics to avoid float errors.
*   **Inventory Isolation**: Where inventory metrics are concealed (common in Amazon or AliExpress), the system flags state value to `is_inventory_unlimited = true` or `stock_status = 'in_stock'`. If inventory levels are obtainable as integers via JSON endpoints, they are mapped down to `inventory_quantity`.
*   **Variant Resolution**: Maps arrays of separate SKUs, holding individual price variables, colors, sizes, and specific variant image references.

---

## 4. Media Ingestion & Optimization

To prevent third-party hotlinking blocks and slow rendering speeds, all product media undergo deep background processing:

1.  **Image Fetching**: Scraper downloads gallery images into temporary memory buffers.
2.  **Conversion**: Node.js sharp workers resize high-definition visuals to standard **1080x1080 (1:1 Ratio)** and save files as optimized **WebP (quality: 85)** to guarantee rapid image rendering times.
3.  **S3 / Cloud Storage Upload**: Visual assets are written into Supabase Storage buckets, structured by tenant workspaces: `/buckets/media/workspaces/{workspace_id}/projects/{project_id}/products/{product_id}/`.
4.  **CDN Routing**: Images are referenced via Cloudflare CDN edge URLs.

---

## 5. Anti-Bot Mitigation & Crawl Reliability

E-commerce targets actively safeguard intellectual properties with Cloudflare, Akamai, or PerimeterX gates. AuraPost employs a three-tier mitigation system:

### 5.1 Residential Proxies & Fingerprint Rotation
-   **Smart Rotator**: Requests pass through specialized residential proxy pools (e.g., Oxylabs or Bright Data) mimicking real home Internet providers.
-   **Browser Fingerprint Emulation**: Workers utilize **FingerprintGenerator** models to swap User-Agent headers, Canvas fingerprints, viewport sizes, and audio configurations on every thread run.
-   **Automated Cookie Jar Handling**: Puppeteer threads maintain and share state variables to satisfy initial CSRF challenge validations.

### 5.2 Capcha & Heavy JS Bypass (ScrapingBee/BrightData Proxy)
If standard residential proxies trigger cloud traps, requests route asynchronously via a rendering API pool that utilizes managed headless browsers capable of resolving JavaScript-heavy environments, returning clean HTML payloads.

### 5.3 Scalable Queueing & Backoff Retry Strategy
All imports run inside **BullMQ / Redis queues**, preventing API bottleneck timeouts.

-   **Concurrency Limit**: Enforced at 5 parallel imports per workspace.
-   **Retry Scheme**: Exponential backoff models are utilized:
    $$RetryInterval = InitialDelay \times (Multiplier)^{attempt-1}$$
    *   *Attempts*: Max 3 retry cycles.
    *   *InitialDelay*: 15 seconds.
    *   *Factor*: 3 (e.g., Attempt 1: 15s delay, Attempt 2: 45s delay, Attempt 3: 135s delay).
-   **Circuit Breaker**: If a single domain fails consecutively 10 times in a 5-minute interval, the domain is temporarily blacklisted for 30 minutes, preventing resource saturation.

---

## 6. Schema Normalization Specification

All items are normalized to a consistent format defined below before database insertion:

```json
{
  "name": "Tapered Aero Titanium Mug",
  "description": "Ultra-insulated double-wall titanium coffee flask.",
  "raw_price": "49.00",
  "normalized_price": 49.00,
  "compare_at_price": 85.00,
  "currency": "USD",
  "category": "Travel Accessories & Gear",
  "brand": "TitaniumCo",
  "vendor": "TitaniumCo",
  "source_platform": "shopify",
  "source_url": "https://myshopify-store.com/products/aero-titanium-mug",
  "images": [
    "https://cdn.aurapost.ai/ws_1/p_1/aero-titanium-mug-primary.webp",
    "https://cdn.aurapost.ai/ws_1/p_1/aero-titanium-mug-gallery.webp"
  ],
  "variants": [
    {
      "sku": "TICO-MUG-SLV",
      "title": "Silver / 12oz",
      "price": 49.00,
      "inventory": 40,
      "attributes": {
        "color": "Silver",
        "size": "12oz"
      }
    }
  ],
  "specification_attributes": {
    "material": "Aerospace Grade Titanium",
    "weight": "12.8oz",
    "insulation_duration": "24h cold, 12h hot"
  }
}
```
