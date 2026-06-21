import crypto from "node:crypto";
import { BaseExtractor } from "./base.ts";
import { NormalizedProduct, ProductVariant } from "../../src/types.ts";
import { TEST_DATASET } from "./test-dataset.ts";

// ─── Cloud Run / Network Compatibility ───────────────────────────────────────
const FETCH_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1_500;
const BACKOFF_MULTIPLIER = 2.0;
const MAX_BACKOFF_MS = 20_000;
const RANDOM_JITTER_MIN = 500;
const RANDOM_JITTER_MAX = 3_000;

const PLACEHOLDER_IMAGE = "https://via.placeholder.com/1200x1200?text=AliExpress+Product";

// ─── Original Helpers (PRESERVED) ────────────────────────────────────────────

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripTags(input: string): string {
  return decodeHtmlEntities(input)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseJsonSafe<T = any>(input: string): T | null {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}

function normalizeImageUrl(input: string): string {
  const value = decodeHtmlEntities(String(input || "")).trim();
  if (!value) return "";
  if (value.startsWith("//")) return `https:${value}`;
  return value;
}

function normalizeText(input: unknown): string {
  return decodeHtmlEntities(String(input || "")).replace(/\s+/g, " ").trim();
}

function normalizePrice(input: string): number {
  const match = normalizeText(input).replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : NaN;
}

function parseAliPromotionInfo(input: unknown): Record<string, any> {
  const text = normalizeText(input);
  if (!text) return {};
  return parseJsonSafe<Record<string, any>>(text) || {};
}

function detectCurrency(input: string): string {
  const value = normalizeText(input);
  if (/\bMYR\b/i.test(value) || value.includes("RM")) return "MYR";
  if (/\bUSD\b/i.test(value) || value.includes("$")) return "USD";
  if (/\bEUR\b/i.test(value) || value.includes("€")) return "EUR";
  if (/\bGBP\b/i.test(value) || value.includes("£")) return "GBP";
  if (/\bJPY\b/i.test(value) || value.includes("¥")) return "JPY";
  return "USD";
}

function cleanupTitle(input: string): string {
  return normalizeText(input)
    .replace(/\s*-\s*AliExpress.*$/i, "")
    .replace(/\s*\|\s*AliExpress.*$/i, "")
    .trim();
}

function extractProductId(url: string): string {
  const cleanUrl = url.split("?")[0].split("#")[0];
  const match = cleanUrl.match(/\/item\/(\d+)\.html/i) || cleanUrl.match(/(\d{8,})/);
  return match?.[1] || "";
}

function parseJsonpPayload<T = any>(input: string): T | null {
  const start = input.indexOf("(");
  const end = input.lastIndexOf(")");
  if (start === -1 || end === -1 || end <= start) {
    return parseJsonSafe<T>(input);
  }
  return parseJsonSafe<T>(input.slice(start + 1, end));
}

function flattenPreContent(preContent: any): string {
  if (!preContent || !Array.isArray(preContent.dataList)) return "";
  return preContent.dataList
    .map((entry: any) => {
      const data = entry?.data || {};
      return [
        data.title,
        data.description,
        data.desc,
        data.value,
      ]
        .map((value) => normalizeText(value))
        .filter(Boolean)
        .join(" ");
    })
    .filter(Boolean)
    .join(" ");
}

function extractMetaContent(html: string, key: string): string {
  const pattern = new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]+content=["']([^"']+)`, "i");
  return normalizeText((html.match(pattern) || [])[1] || "");
}

function detectAliExpressPageError(html: string, title: string): string | null {
  const content = `${title}\n${html}`.toLowerCase();
  if (content.includes("sorry, the page you requested can not be found")) {
    return "AliExpress product page returned a not found screen.";
  }
  if (content.includes("punish") || content.includes("captcha") || content.includes("robot")) {
    return "AliExpress anti-bot or verification page detected.";
  }
  return null;
}

function getAliSelectedSkuId(result: any): string {
  return String(
    result?.SKU?.selectedSkuIdStr
    || result?.SKU?.selectedSkuId
    || result?.PRICE?.selectedSkuId
    || ""
  ).trim();
}

function getAliSelectedPriceInfo(result: any): any {
  const selectedSkuId = getAliSelectedSkuId(result);
  if (!selectedSkuId) {
    return result?.PRICE?.targetSkuPriceInfo || {};
  }

  return (
    result?.PRICE?.skuIdStrPriceInfoMap?.[selectedSkuId]
    || result?.PRICE?.skuPriceInfoMap?.[selectedSkuId]
    || result?.PRICE?.skuPriceInfoMap?.[String(selectedSkuId)]
    || result?.PRICE?.targetSkuPriceInfo
    || {}
  );
}

function shouldPreferRegularPrice(result: any, selectedPriceInfo: any, salePrice: number, regularPrice: number): boolean {
  const promotionInfo = parseAliPromotionInfo(result?.GLOBAL_DATA?.globalData?.curPagePriceInfo?.promotionInfo);
  const hasNewUserPromotion =
    result?.PERSONAL_INFORMATION_SECURITY?.features?.newUser === true
    || Object.keys(promotionInfo).some((key) => /new.?user/i.test(key))
    || /new.?user/i.test(normalizeText(JSON.stringify(promotionInfo)));

  if (!hasNewUserPromotion) return false;
  if (isNaN(salePrice) || isNaN(regularPrice)) return false;
  if (salePrice <= 0.99) return true;
  return salePrice <= regularPrice * 0.35;
}

function resolveAliPrice(result: any, pageHtml: string): {
  price: number;
  compareAtPrice?: number;
  currency: string;
} {
  const selectedPriceInfo = getAliSelectedPriceInfo(result);
  const targetPriceInfo = result?.PRICE?.targetSkuPriceInfo || {};
  const firstPriceInfo = Object.values(result?.PRICE?.skuIdStrPriceInfoMap || result?.PRICE?.skuPriceInfoMap || {})[0] as any;

  const selectedSalePriceText = normalizeText(
    selectedPriceInfo?.salePriceString
    || selectedPriceInfo?.salePriceLocal
    || selectedPriceInfo?.activityAmount?.formatedAmount
    || selectedPriceInfo?.skuActivityAmount?.formatedAmount
    || ""
  );
  const selectedRegularPriceText = normalizeText(
    selectedPriceInfo?.originalPrice?.formatedAmount || ""
  );
  const targetSalePriceText = normalizeText(
    targetPriceInfo?.salePriceString
    || targetPriceInfo?.salePriceLocal
    || targetPriceInfo?.activityAmount?.formatedAmount
    || targetPriceInfo?.skuActivityAmount?.formatedAmount
    || ""
  );
  const targetRegularPriceText = normalizeText(targetPriceInfo?.originalPrice?.formatedAmount || "");
  const firstSalePriceText = normalizeText(
    firstPriceInfo?.salePriceString
    || firstPriceInfo?.salePriceLocal
    || firstPriceInfo?.activityAmount?.formatedAmount
    || firstPriceInfo?.skuActivityAmount?.formatedAmount
    || ""
  );
  const firstRegularPriceText = normalizeText(firstPriceInfo?.originalPrice?.formatedAmount || "");

  const selectedSalePrice = normalizePrice(selectedSalePriceText);
  const selectedRegularPrice = normalizePrice(selectedRegularPriceText);
  const targetSalePrice = normalizePrice(targetSalePriceText);
  const targetRegularPrice = normalizePrice(targetRegularPriceText);
  const firstSalePrice = normalizePrice(firstSalePriceText);
  const firstRegularPrice = normalizePrice(firstRegularPriceText);

  const preferredPriceText = shouldPreferRegularPrice(result, selectedPriceInfo, selectedSalePrice, selectedRegularPrice)
    ? selectedRegularPriceText
    : (
      selectedSalePriceText
      || targetSalePriceText
      || firstSalePriceText
      || selectedRegularPriceText
      || targetRegularPriceText
      || firstRegularPriceText
      || extractMetaContent(pageHtml, "og:price:amount")
    );

  const preferredCompareAtText = normalizeText(
    selectedRegularPriceText
    || targetRegularPriceText
    || firstRegularPriceText
  );

  return {
    price: normalizePrice(preferredPriceText),
    compareAtPrice: normalizePrice(preferredCompareAtText),
    currency: detectCurrency(preferredPriceText || preferredCompareAtText || "USD"),
  };
}

// ─── NEW: Cloud Run / Anti-Bot Infrastructure ────────────────────────────────

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface BrowserProfile {
  userAgent: string;
  accept: string;
  acceptLang: string;
  secChUa: string;
  secChUaMobile: string;
  secChUaPlatform: string;
}

const BROWSER_PROFILES: BrowserProfile[] = [
  {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    acceptLang: "en-US,en;q=0.9",
    secChUa: '"Not-A.Brand";v="99", "Chromium";v="124"',
    secChUaMobile: "?0",
    secChUaPlatform: '"Windows"',
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    acceptLang: "en-US,en;q=0.9",
    secChUa: '"Not-A.Brand";v="99", "Chromium";v="125", "Microsoft Edge";v="125"',
    secChUaMobile: "?0",
    secChUaPlatform: '"Windows"',
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    acceptLang: "en-US,en;q=0.5",
    secChUa: '"Not-A.Brand";v="99"',
    secChUaMobile: "?0",
    secChUaPlatform: '"Windows"',
  },
  {
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    acceptLang: "en-US,en;q=0.9",
    secChUa: '"Not-A.Brand";v="99", "Chromium";v="124"',
    secChUaMobile: "?0",
    secChUaPlatform: '"macOS"',
  },
  {
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    acceptLang: "en-US,en;q=0.9",
    secChUa: '"Apple WebKit";v="605.1.15"',
    secChUaMobile: "?0",
    secChUaPlatform: '"macOS"',
  },
  {
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    acceptLang: "en-US,en;q=0.9",
    secChUa: '"Not-A.Brand";v="99", "Chromium";v="124"',
    secChUaMobile: "?0",
    secChUaPlatform: '"Linux"',
  },
  {
    userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    acceptLang: "en-US,en;q=0.5",
    secChUa: '"Not-A.Brand";v="99"',
    secChUaMobile: "?0",
    secChUaPlatform: '"Linux"',
  },
  {
    userAgent: "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    acceptLang: "en-US,en;q=0.9",
    secChUa: '"Not-A.Brand";v="99", "Chromium";v="124"',
    secChUaMobile: "?1",
    secChUaPlatform: '"Android"',
  },
];

/**
 * Build randomized headers from a rotating browser profile.
 */
function buildRandomHeaders(referer?: string): Record<string, string> {
  const profile = BROWSER_PROFILES[randomInt(0, BROWSER_PROFILES.length - 1)];
  return {
    "User-Agent": profile.userAgent,
    "Accept": profile.accept,
    "Accept-Language": profile.acceptLang,
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Referer": referer || "https://www.google.com/",
    "Sec-Ch-Ua": profile.secChUa,
    "Sec-Ch-Ua-Mobile": profile.secChUaMobile,
    "Sec-Ch-Ua-Platform": profile.secChUaPlatform,
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": referer ? "cross-site" : "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "Connection": "keep-alive",
    "DNT": "1",
  };
}

// ─── Cookie Jar ──────────────────────────────────────────────────────────────

class CookieJar {
  private cookies = new Map<string, string>();

  setFromResponse(response: Response) {
    const setCookies = response.headers.getSetCookie?.() || [];
    for (const rawCookie of setCookies) {
      const [pair] = rawCookie.split(";");
      const separatorIndex = pair.indexOf("=");
      if (separatorIndex > 0) {
        this.cookies.set(pair.slice(0, separatorIndex), pair.slice(separatorIndex + 1));
      }
    }
  }

  buildHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  getJar(): Map<string, string> {
    return this.cookies;
  }
}

// ─── Retry + Timeout Helper ──────────────────────────────────────────────────

async function fetchWithRetry(url: string, headers: Record<string, string>, cookies: CookieJar, attempt = 1): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const cookieHeader = cookies.buildHeader();
  if (cookieHeader) {
    headers["Cookie"] = cookieHeader;
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      redirect: "follow",
      signal: controller.signal,
    });

    cookies.setFromResponse(response);

    if ((response.status === 403 || response.status === 404 || response.status === 429 || response.status === 503) && attempt <= MAX_RETRIES) {
      const delay = Math.min(
        INITIAL_BACKOFF_MS * Math.pow(BACKOFF_MULTIPLIER, attempt - 1),
        MAX_BACKOFF_MS
      ) + randomInt(RANDOM_JITTER_MIN, RANDOM_JITTER_MAX);
      console.warn(
        `[AliExpressExtractor] HTTP ${response.status} (attempt ${attempt}/${MAX_RETRIES + 1}). ` +
        `Retrying in ${delay}ms...`
      );
      await sleep(delay);
      return fetchWithRetry(url, buildRandomHeaders(), cookies, attempt + 1);
    }

    return response;
  } catch (error: any) {
    const isTimeout = error.name === "AbortError" || error.message?.includes("aborted");
    const isNetwork = error.message?.includes("fetch failed")
      || error.message?.includes("ECONNREFUSED")
      || error.message?.includes("ETIMEDOUT")
      || error.message?.includes("ENOTFOUND")
      || error.message?.includes("ECONNRESET")
      || error.message?.includes("socket hang up");

    const shouldRetry = (isTimeout || isNetwork) && attempt <= MAX_RETRIES;

    if (shouldRetry) {
      const delay = Math.min(
        INITIAL_BACKOFF_MS * Math.pow(BACKOFF_MULTIPLIER, attempt - 1),
        MAX_BACKOFF_MS
      ) + randomInt(RANDOM_JITTER_MIN, RANDOM_JITTER_MAX);
      console.warn(
        `[AliExpressExtractor] Network error (attempt ${attempt}/${MAX_RETRIES + 1}): ${error.message}. ` +
        `Retrying in ${delay}ms...`
      );
      await sleep(delay);
      return fetchWithRetry(url, buildRandomHeaders(), cookies, attempt + 1);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── NEW: Enhanced Anti-Bot Detection ──────────────────────────────────────────

function detectAliExpressAntiBot(html: string): string | null {
  const checks: Array<[RegExp, string]> = [
    [/captcha/i, "AliExpress captcha verification page detected."],
    [/robot check/i, "AliExpress robot check page detected."],
    [/security verification/i, "AliExpress security verification page detected."],
    [/access denied/i, "AliExpress access denied page detected."],
    [/challenge platform/i, "Cloudflare challenge page detected."],
    [/cf-browser-verification/i, "Cloudflare browser verification detected."],
    [/just a moment/i, "Cloudflare \"Just a Moment\" interstitial detected."],
    [/bot detection/i, "AliExpress bot detection triggered."],
    [/slide to verify/i, "AliExpress slide verification detected."],
    [/verify you are human/i, "AliExpress human verification page detected."],
  ];

  for (const [pattern, message] of checks) {
    if (pattern.test(html)) {
      return message;
    }
  }

  return null;
}

// ─── NEW: Recursive JSON Image Extraction ────────────────────────────────────

function extractImagesFromObject(obj: any): string[] {
  const urls: string[] = [];
  if (!obj) return urls;

  if (typeof obj === "string") {
    if (obj.startsWith("http") && (obj.includes("alicdn.com") || obj.includes("alibaba.com"))) {
      urls.push(obj);
    }
    return urls;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item) => urls.push(...extractImagesFromObject(item)));
    return urls;
  }

  if (typeof obj === "object") {
    const imageKeys = [
      "image", "images", "imageUrl", "imageUrls", "imgUrl", "imgUrls",
      "mainImage", "mainImages", "subjectImages", "skuImages", "skuImage",
      "imagePath", "imagePathList", "imageList", "detailImageList",
      "galleryImage", "thumbnail", "thumb", "url", "src", "photoUrl",
    ];
    for (const key of imageKeys) {
      if (obj[key] !== undefined) {
        urls.push(...extractImagesFromObject(obj[key]));
      }
    }
    Object.values(obj).forEach((value) => {
      urls.push(...extractImagesFromObject(value));
    });
  }

  return urls;
}

// ─── NEW: Enhanced Image Extraction (15 strategies) ───────────────────────────

function extractAliExpressImages(html: string): string[] {
  const allUrls = new Set<string>();
  let strategyCount = 0;

  // ─── Strategy 1: __NEXT_DATA__ JSON ───────────────────────────────────────
  strategyCount++;
  const nextDataMatch = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nextDataMatch?.[1]) {
    try {
      const nextData = parseJsonSafe<any>(nextDataMatch[1].trim());
      const images = extractImagesFromObject(nextData);
      if (images.length > 0) {
        images.forEach((url: string) => allUrls.add(normalizeImageUrl(url)));
        console.log(`[AliExpress] Strategy ${strategyCount} (__NEXT_DATA__) found ${images.length} images`);
      } else {
        console.log(`[AliExpress] Strategy ${strategyCount} (__NEXT_DATA__) found 0 images`);
      }
    } catch (err: any) {
      console.log(`[AliExpress] Strategy ${strategyCount} (__NEXT_DATA__) parse failed: ${err.message}`);
    }
  } else {
    console.log(`[AliExpress] Strategy ${strategyCount} (__NEXT_DATA__) not found`);
  }

  // ─── Strategy 2: window.__INITIAL_STATE__ ─────────────────────────────────
  strategyCount++;
  const initialStateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/i) ||
                             html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?})<\/script>/i);
  if (initialStateMatch?.[1]) {
    try {
      const initialState = parseJsonSafe<any>(initialStateMatch[1].trim());
      const images = extractImagesFromObject(initialState);
      if (images.length > 0) {
        images.forEach((url: string) => allUrls.add(normalizeImageUrl(url)));
        console.log(`[AliExpress] Strategy ${strategyCount} (__INITIAL_STATE__) found ${images.length} images`);
      } else {
        console.log(`[AliExpress] Strategy ${strategyCount} (__INITIAL_STATE__) found 0 images`);
      }
    } catch (err: any) {
      console.log(`[AliExpress] Strategy ${strategyCount} (__INITIAL_STATE__) parse failed: ${err.message}`);
    }
  } else {
    console.log(`[AliExpress] Strategy ${strategyCount} (__INITIAL_STATE__) not found`);
  }

  // ─── Strategy 3: window.runParams ─────────────────────────────────────────
  strategyCount++;
  const runParamsMatch = html.match(/window\.runParams\s*=\s*({[\s\S]*?});/i) ||
                         html.match(/window\.runParams\s*=\s*({[\s\S]*?})<\/script>/i);
  if (runParamsMatch?.[1]) {
    try {
      const runParams = parseJsonSafe<any>(runParamsMatch[1].trim());
      const images = extractImagesFromObject(runParams);
      if (images.length > 0) {
        images.forEach((url: string) => allUrls.add(normalizeImageUrl(url)));
        console.log(`[AliExpress] Strategy ${strategyCount} (window.runParams) found ${images.length} images`);
      } else {
        console.log(`[AliExpress] Strategy ${strategyCount} (window.runParams) found 0 images`);
      }
    } catch (err: any) {
      console.log(`[AliExpress] Strategy ${strategyCount} (window.runParams) parse failed: ${err.message}`);
    }
  } else {
    console.log(`[AliExpress] Strategy ${strategyCount} (window.runParams) not found`);
  }

  // ─── Strategy 4: window.__APP_DATA__ ──────────────────────────────────────
  strategyCount++;
  const appDataMatch = html.match(/window\.__APP_DATA__\s*=\s*({[\s\S]*?});/i) ||
                       html.match(/window\.__APP_DATA__\s*=\s*({[\s\S]*?})<\/script>/i);
  if (appDataMatch?.[1]) {
    try {
      const appData = parseJsonSafe<any>(appDataMatch[1].trim());
      const images = extractImagesFromObject(appData);
      if (images.length > 0) {
        images.forEach((url: string) => allUrls.add(normalizeImageUrl(url)));
        console.log(`[AliExpress] Strategy ${strategyCount} (__APP_DATA__) found ${images.length} images`);
      } else {
        console.log(`[AliExpress] Strategy ${strategyCount} (__APP_DATA__) found 0 images`);
      }
    } catch (err: any) {
      console.log(`[AliExpress] Strategy ${strategyCount} (__APP_DATA__) parse failed: ${err.message}`);
    }
  } else {
    console.log(`[AliExpress] Strategy ${strategyCount} (__APP_DATA__) not found`);
  }

  // ─── Strategy 5: Embedded JSON blocks with image keywords ─────────────────
  strategyCount++;
  const imageKeywords = ["imageModule", "productInfo", "skuModule", "skuProps", "imageList"];
  let scriptImages = 0;
  const scriptBlocks = Array.from(html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi));
  for (const script of scriptBlocks) {
    const content = script[1];
    for (const keyword of imageKeywords) {
      if (content.includes(keyword)) {
        try {
          const json = parseJsonSafe<any>(content);
          if (json) {
            const images = extractImagesFromObject(json);
            images.forEach((url: string) => {
              if (url.startsWith("http")) {
                allUrls.add(normalizeImageUrl(url));
                scriptImages++;
              }
            });
          }
        } catch {
          const urlMatches = Array.from(content.matchAll(/https?:\/\/[^"'\s)]+/gi));
          urlMatches.forEach((m) => {
            const url = m[0].trim();
            if (url.startsWith("http")) {
              allUrls.add(normalizeImageUrl(url));
              scriptImages++;
            }
          });
        }
      }
    }
  }
  console.log(`[AliExpress] Strategy ${strategyCount} (embedded JSON blocks) found ${scriptImages} images`);

  // ─── Strategy 6: Broad regex for alicdn.com images ──────────────────────
  strategyCount++;
  const alicdnPatterns = [
    /https?:\/\/[^"'\s)]+alicdn\.com[^"'\s)]*\.(jpg|jpeg|png|webp)/gi,
    /https?:\/\/[^"'\s)]+alibaba\.com[^"'\s)]*\.(jpg|jpeg|png|webp)/gi,
  ];
  let alicdnImages = 0;
  for (const pattern of alicdnPatterns) {
    const matches = Array.from(html.matchAll(pattern));
    matches.forEach((m) => {
      const url = m[0].trim();
      if (url.startsWith("http")) {
        allUrls.add(normalizeImageUrl(url));
        alicdnImages++;
      }
    });
  }
  console.log(`[AliExpress] Strategy ${strategyCount} (alicdn regex) found ${alicdnImages} images`);

  // ─── Strategy 7: og:image ─────────────────────────────────────────────────
  strategyCount++;
  const ogImage = extractMetaContent(html, "og:image");
  if (ogImage && ogImage.startsWith("http")) {
    allUrls.add(normalizeImageUrl(ogImage));
    console.log(`[AliExpress] Strategy ${strategyCount} (og:image) found 1 image`);
  } else {
    console.log(`[AliExpress] Strategy ${strategyCount} (og:image) not found`);
  }

  // ─── Strategy 8: twitter:image ────────────────────────────────────────────
  strategyCount++;
  const twImage = extractMetaContent(html, "twitter:image");
  if (twImage && twImage.startsWith("http")) {
    allUrls.add(normalizeImageUrl(twImage));
    console.log(`[AliExpress] Strategy ${strategyCount} (twitter:image) found 1 image`);
  } else {
    console.log(`[AliExpress] Strategy ${strategyCount} (twitter:image) not found`);
  }

  // ─── Strategy 9: data-src lazy-loaded images ──────────────────────────────
  strategyCount++;
  const dataSrcMatches = Array.from(
    html.matchAll(/<img[^>]+data-src=["']([^"']+)["'][^>]*>/gi)
  );
  let dataSrcImages = 0;
  dataSrcMatches.forEach((m) => {
    const url = decodeHtmlEntities(m[1]).trim();
    if (url.startsWith("http")) {
      allUrls.add(normalizeImageUrl(url));
      dataSrcImages++;
    }
  });
  console.log(`[AliExpress] Strategy ${strategyCount} (data-src) found ${dataSrcImages} images`);

  // ─── Strategy 10: src attributes on alicdn/alibaba images ─────────────────
  strategyCount++;
  const srcMatches = Array.from(
    html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)
  );
  let srcImages = 0;
  srcMatches.forEach((m) => {
    const url = decodeHtmlEntities(m[1]).trim();
    if (url.startsWith("http") && (url.includes("alicdn.com") || url.includes("alibaba.com"))) {
      allUrls.add(normalizeImageUrl(url));
      srcImages++;
    }
  });
  console.log(`[AliExpress] Strategy ${strategyCount} (img src) found ${srcImages} images`);

  // ─── Strategy 11: Gallery containers ────────────────────────────────────────
  strategyCount++;
  const galleryMatches = Array.from(
    html.matchAll(/id=["'][^"']*gallery[^"']*["'][\s\S]{0,5000}?<img[^>]+(?:src|data-src)=["']([^"']+)["']/gi)
  );
  let galleryImages = 0;
  galleryMatches.forEach((m) => {
    const url = decodeHtmlEntities(m[1]).trim();
    if (url.startsWith("http")) {
      allUrls.add(normalizeImageUrl(url));
      galleryImages++;
    }
  });
  console.log(`[AliExpress] Strategy ${strategyCount} (gallery containers) found ${galleryImages} images`);

  // ─── Strategy 12: Thumbnail containers ────────────────────────────────────
  strategyCount++;
  const thumbMatches = Array.from(
    html.matchAll(/class=["'][^"']*thumb[^"']*["'][^>]+(?:src|data-src)=["']([^"']+)["']/gi)
  );
  let thumbImages = 0;
  thumbMatches.forEach((m) => {
    const url = decodeHtmlEntities(m[1]).trim();
    if (url.startsWith("http")) {
      allUrls.add(normalizeImageUrl(url));
      thumbImages++;
    }
  });
  console.log(`[AliExpress] Strategy ${strategyCount} (thumbnail containers) found ${thumbImages} images`);

  // ─── Strategy 13: Image viewer containers ─────────────────────────────────
  strategyCount++;
  const viewerMatches = Array.from(
    html.matchAll(/class=["'][^"']*image-viewer[^"']*["'][\s\S]{0,3000}?<img[^>]+(?:src|data-src)=["']([^"']+)["']/gi)
  );
  let viewerImages = 0;
  viewerMatches.forEach((m) => {
    const url = decodeHtmlEntities(m[1]).trim();
    if (url.startsWith("http")) {
      allUrls.add(normalizeImageUrl(url));
      viewerImages++;
    }
  });
  console.log(`[AliExpress] Strategy ${strategyCount} (image-viewer) found ${viewerImages} images`);

  // ─── Strategy 14: JSON keys (mainImage, subjectImages, etc.) ──────────────
  strategyCount++;
  const imageKeys = ["mainImage", "mainImages", "subjectImages", "skuImages", "imagePathList", "galleryImage", "detailImageList"];
  let keyImages = 0;
  for (const key of imageKeys) {
    const pattern = new RegExp(`"${key}"\s*:\s*\[([^\]]+)\]`, "i");
    const match = html.match(pattern);
    if (match?.[1]) {
      const urls = match[1].match(/https?:\/\/[^"'\s,)]+/gi) || [];
      urls.forEach((url) => {
        if (url.startsWith("http")) {
          allUrls.add(normalizeImageUrl(url));
          keyImages++;
        }
      });
    }
    const objPattern = new RegExp(`"${key}"\s*:\s*"([^"]+)"`, "i");
    const objMatch = html.match(objPattern);
    if (objMatch?.[1]) {
      const url = objMatch[1].trim();
      if (url.startsWith("http")) {
        allUrls.add(normalizeImageUrl(url));
        keyImages++;
      }
    }
  }
  console.log(`[AliExpress] Strategy ${strategyCount} (image keys) found ${keyImages} images`);

  // ─── Strategy 15: Final broad HTML scan for all alicdn URLs ───────────────
  strategyCount++;
  const broadMatches = Array.from(
    html.matchAll(/https?:\/\/[^"'\s)]+alicdn\.com[^"'\s)]+/gi)
  );
  let broadImages = 0;
  broadMatches.forEach((m) => {
    const url = m[0].trim();
    if (url.startsWith("http")) {
      allUrls.add(normalizeImageUrl(url));
      broadImages++;
    }
  });
  console.log(`[AliExpress] Strategy ${strategyCount} (broad alicdn scan) found ${broadImages} images`);

  const result = [...allUrls];
  console.log(`[AliExpress] Total unique images extracted: ${result.length}`);
  return result;
}

// ─── NEW: Embedded Data Extraction ───────────────────────────────────────────

function extractAliExpressEmbeddedData(html: string): any | null {
  // Strategy 1: window.runParams
  const runParamsMatch = html.match(/window\.runParams\s*=\s*({[\s\S]*?});/i);
  if (runParamsMatch?.[1]) {
    try {
      return parseJsonSafe<any>(runParamsMatch[1]);
    } catch {
      // Continue
    }
  }

  // Strategy 2: window.__INITIAL_STATE__
  const initialStateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/i);
  if (initialStateMatch?.[1]) {
    try {
      return parseJsonSafe<any>(initialStateMatch[1]);
    } catch {
      // Continue
    }
  }

  // Strategy 3: window.__NEXT_DATA__
  const nextDataMatch = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nextDataMatch?.[1]) {
    try {
      return parseJsonSafe<any>(nextDataMatch[1]);
    } catch {
      // Continue
    }
  }

  // Strategy 4: window.__APP_DATA__
  const appDataMatch = html.match(/window\.__APP_DATA__\s*=\s*({[\s\S]*?});/i);
  if (appDataMatch?.[1]) {
    try {
      return parseJsonSafe<any>(appDataMatch[1]);
    } catch {
      // Continue
    }
  }

  return null;
}

// ─── Extractor Class ─────────────────────────────────────────────────────────

export class AliExpressExtractor extends BaseExtractor {
  providerName = "AliExpress";

  private readonly appKey = "12574478";
  private readonly apiName = "mtop.aliexpress.pdp.pc.query";
  private cookieJar = new CookieJar();
  private homepageBootstrapped = false;

  private buildAliData(productId: string) {
    return {
      productId,
      _lang: "en_US",
      _currency: "USD",
      country: "US",
      province: "",
      city: "",
      channel: "",
      pdp_ext_f: "",
      pdpNPI: "",
      sourceType: "",
      clientType: "pc",
      ext: JSON.stringify({
        site: "glo",
        crawler: false,
        host: "www.aliexpress.com",
      }),
    };
  }

  private getBrowserHeaders(referer: string): Record<string, string> {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      "Referer": referer,
      "Sec-Ch-Ua": '"Not-A.Brand";v="99", "Chromium";v="124"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"Windows"',
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "cross-site",
      "Upgrade-Insecure-Requests": "1",
      "Connection": "keep-alive",
    };
  }

  private buildCookieHeader(cookies: Map<string, string>): string {
    return Array.from(cookies.entries()).map(([key, value]) => `${key}=${value}`).join("; ");
  }

  private mergeSetCookies(response: Response, cookies: Map<string, string>) {
    const setCookies = response.headers.getSetCookie?.() || [];
    for (const rawCookie of setCookies) {
      const [pair] = rawCookie.split(";");
      const separatorIndex = pair.indexOf("=");
      if (separatorIndex > 0) {
        cookies.set(pair.slice(0, separatorIndex), pair.slice(separatorIndex + 1));
      }
    }
  }

  // ─── ORIGINAL fetch methods (PRESERVED) ───────────────────────────────────
  private async fetchAliExpressPage(url: string, cookies: Map<string, string>): Promise<string> {
    const headers = this.getBrowserHeaders(url);
    const cookieHeader = this.buildCookieHeader(cookies);
    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }

    const response = await fetch(url, {
      headers,
      redirect: "follow",
    });

    this.mergeSetCookies(response, cookies);

    if (!response.ok) {
      throw new Error(`AliExpress product page returned HTTP ${response.status}.`);
    }

    return await response.text();
  }

  private async bootstrapApiCookies(url: string, productId: string, cookies: Map<string, string>) {
    const data = JSON.stringify(this.buildAliData(productId));
    const params = new URLSearchParams({
      jsv: "2.5.1",
      appKey: this.appKey,
      t: Date.now().toString(),
      sign: "",
      api: this.apiName,
      type: "originaljsonp",
      v: "1.0",
      timeout: "15000",
      dataType: "originaljsonp",
      callback: "mtopjsonp0",
      data,
    });

    const response = await fetch(`https://acs.aliexpress.com/h5/${this.apiName}/1.0/?${params}`, {
      headers: {
        ...this.getBrowserHeaders(url),
        "Accept": "*/*",
      },
    });

    this.mergeSetCookies(response, cookies);
  }

  private async fetchAliExpressApiResult(url: string, productId: string) {
    const cookies = new Map<string, string>();
    await this.bootstrapApiCookies(url, productId, cookies);

    const token = (cookies.get("_m_h5_tk") || "").split("_")[0];
    if (!token) {
      throw new Error("AliExpress API bootstrap did not return a signing token.");
    }

    const data = JSON.stringify(this.buildAliData(productId));
    const timestamp = Date.now().toString();
    const sign = crypto.createHash("md5").update(`${token}&${timestamp}&${this.appKey}&${data}`).digest("hex");
    const params = new URLSearchParams({
      jsv: "2.5.1",
      appKey: this.appKey,
      t: timestamp,
      sign,
      api: this.apiName,
      type: "originaljsonp",
      v: "1.0",
      timeout: "15000",
      dataType: "originaljsonp",
      callback: "mtopjsonp1",
      data,
    });

    const response = await fetch(`https://acs.aliexpress.com/h5/${this.apiName}/1.0/?${params}`, {
      headers: {
        ...this.getBrowserHeaders(url),
        "Accept": "*/*",
        "Cookie": this.buildCookieHeader(cookies),
      },
    });

    this.mergeSetCookies(response, cookies);

    if (!response.ok) {
      throw new Error(`AliExpress API returned HTTP ${response.status}.`);
    }

    const payload = parseJsonpPayload<any>(await response.text());
    const result = payload?.data?.result;
    if (!result || payload?.ret?.some((entry: string) => /FAIL|ERROR/i.test(entry))) {
      throw new Error(`AliExpress API response was missing product data for ${url}.`);
    }

    return { result, cookies };
  }

  private async fetchDescription(descUrl: string, referer: string, cookies: Map<string, string>): Promise<string> {
    if (!descUrl) return "";

    const response = await fetch(descUrl, {
      headers: {
        ...this.getBrowserHeaders(referer),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Cookie": this.buildCookieHeader(cookies),
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return "";
    }

    return stripTags(await response.text());
  }

  private extractGallery(result: any): string[] {
    const imageCandidates = [
      ...(result?.HEADER_IMAGE_PC?.imagePathList || []),
      result?.GLOBAL_DATA?.globalData?.image,
      ...(result?.SKU?.skuProperties || []).flatMap((property: any) =>
        (property?.skuPropertyValues || []).flatMap((value: any) => [
          value?.skuPropertyImagePath,
          value?.skuPropertyImageSummPath,
        ])
      ),
    ];

    return [...new Set(
      imageCandidates
        .map((value: unknown) => normalizeImageUrl(String(value || "")))
        .filter((value) => value.startsWith("http"))
    )];
  }

  private extractVariants(result: any, fallbackPrice: number): ProductVariant[] {
    const skuPaths = Array.isArray(result?.SKU?.skuPaths) ? result.SKU.skuPaths : [];
    const skuPriceInfoMap = result?.PRICE?.skuIdStrPriceInfoMap || result?.PRICE?.skuPriceInfoMap || {};

    const variants = skuPaths.map((pathEntry: any, index: number) => {
      const skuId = String(pathEntry?.skuIdStr || pathEntry?.skuId || `ali-sku-${index}`);
      const rawTitle = String(pathEntry?.skuAttr || "")
        .split(";")
        .map((part) => normalizeText(part.split("#")[1] || part.split(":")[1] || part))
        .filter(Boolean)
        .join(" / ");
      const priceInfo = skuPriceInfoMap?.[skuId] || skuPriceInfoMap?.[String(pathEntry?.skuId || "")] || {};
      const salePriceText = normalizeText(
        priceInfo?.salePriceString
        || priceInfo?.salePriceLocal
        || priceInfo?.activityAmount?.formatedAmount
        || priceInfo?.skuActivityAmount?.formatedAmount
        || ""
      );
      const regularPriceText = normalizeText(priceInfo?.originalPrice?.formatedAmount || "");
      const salePrice = normalizePrice(salePriceText);
      const regularPrice = normalizePrice(regularPriceText);
      const parsedPrice = shouldPreferRegularPrice(result, priceInfo, salePrice, regularPrice)
        ? regularPrice
        : salePrice;

      return {
        id: skuId,
        title: rawTitle || `Variant ${index + 1}`,
        price: (!isNaN(parsedPrice) ? parsedPrice : fallbackPrice).toFixed(2),
        inventory: typeof pathEntry?.skuStock === "number" ? pathEntry.skuStock : undefined,
        sku: skuId,
      };
    });

    return variants.length > 0 ? variants : [{
      id: "ali-default",
      title: "Default",
      price: fallbackPrice.toFixed(2),
    }];
  }

  private extractSpecifications(result: any): Record<string, string> {
    const specifications: Record<string, string> = {};
    const props = Array.isArray(result?.PRODUCT_PROP_PC?.showedProps) ? result.PRODUCT_PROP_PC.showedProps : [];

    for (const item of props) {
      const key = normalizeText(item?.attrName);
      const value = normalizeText(item?.attrValue);
      if (key && value) {
        specifications[key] = value;
      }
    }

    const storeName = normalizeText(result?.GLOBAL_DATA?.globalData?.storeName);
    if (storeName) {
      specifications.Store = storeName;
    }

    return specifications;
  }

  // ─── NEW: Enhanced fetch with anti-bot bypass ───────────────────────────────
  private async fetchAliExpressPageEnhanced(url: string): Promise<string> {
    let lastHtml = "";
    let lastStatus = 0;

    for (let i = 0; i < 3; i++) {
      try {
        const headers = buildRandomHeaders();
        console.log(`[AliExpressExtractor] Fetch attempt ${i + 1} with UA: ${headers["User-Agent"].slice(0, 60)}...`);

        const res = await fetchWithRetry(url, headers, this.cookieJar);
        lastStatus = res.status;

        if (!res.ok) {
          console.warn(`[AliExpressExtractor] HTTP ${res.status}`);
          if (res.status === 403 || res.status === 503) {
            const delay = randomInt(2_000, 5_000);
            console.log(`[AliExpressExtractor] ${res.status} detected, waiting ${delay}ms...`);
            await sleep(delay);
            continue;
          }
          continue;
        }

        const html = await res.text();
        lastHtml = html;

        const antiBotError = detectAliExpressAntiBot(html);
        if (antiBotError) {
          console.warn(`[AliExpressExtractor] Anti-bot detected: ${antiBotError}`);
          const delay = randomInt(2_000, 5_000);
          await sleep(delay);
          continue;
        }

        return html;
      } catch (error: any) {
        console.warn(`[AliExpressExtractor] Fetch attempt ${i + 1} failed: ${error.message}`);
        const delay = randomInt(1_500, 4_000);
        await sleep(delay);
      }
    }

    if (lastHtml) {
      return lastHtml;
    }

    throw new Error(`AliExpress extraction failed: received HTTP ${lastStatus || "unknown"} from the live store page.`);
  }

  public async extract(url: string, rawHtml?: string, customPrompt?: string): Promise<NormalizedProduct> {
    const cleanUrl = url.split("?")[0].split("#")[0];
    const isForcedFallback = url.toLowerCase().includes("force_fallback=true");

    if (isForcedFallback) {
      if (!this.isTestMode()) {
        throw new Error(`Synthetic fallback is disabled for ${this.providerName} imports. Unable to import ${url}.`);
      }
      return this.parseUrlFallback(url, this.providerName);
    }

    const matched = this.isTestMode() ? TEST_DATASET[this.providerName]?.find(
      (x) => x.url.toLowerCase().split("?")[0].split("#")[0] === cleanUrl.toLowerCase()
    ) : undefined;

    if (matched) {
      if (matched.success && matched.product) {
        console.log(`[AliExpressExtractor] Deep-crawl offline database hit for: ${matched.product.title}`);
        return matched.product;
      }
      throw new Error(matched.error?.errorMessage || "Simulated extraction failure for test URL.");
    }

    const productId = extractProductId(url);
    if (!productId) {
      throw new Error(`AliExpress extraction failed. Could not determine a product ID from ${url}.`);
    }

    // ─── NEW: Bootstrap homepage cookies ────────────────────────────────────
    if (!this.homepageBootstrapped) {
      try {
        console.log(`[AliExpressExtractor] Bootstrapping AliExpress homepage cookies...`);
        const homeHeaders = buildRandomHeaders("https://www.google.com/");
        const homeRes = await fetchWithRetry("https://www.aliexpress.com/", homeHeaders, this.cookieJar);
        if (homeRes.ok) {
          console.log(`[AliExpressExtractor] Homepage bootstrap successful, cookies stored: ${this.cookieJar.getJar().size}`);
          this.homepageBootstrapped = true;
          await sleep(randomInt(1_000, 3_000));
        }
      } catch (err: any) {
        console.warn(`[AliExpressExtractor] Homepage bootstrap failed (non-fatal): ${err.message}`);
      }
    }

    const bootstrapCookies = new Map<string, string>();
    let pageHtml = rawHtml?.trim() || "";
    let pageTitle = "";

    try {
      if (!pageHtml) {
        pageHtml = await this.fetchAliExpressPageEnhanced(cleanUrl);
      }
      pageTitle = cleanupTitle((pageHtml.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1] || "");
    } catch (error: any) {
      console.warn(`[AliExpressExtractor] Product page bootstrap warning for ${cleanUrl}:`, error.message);
      pageHtml = "";
      pageTitle = "";
    }

    let result: any;
    let cookies: Map<string, string>;

    try {
      const apiResult = await this.fetchAliExpressApiResult(cleanUrl, productId);
      result = apiResult.result;
      cookies = apiResult.cookies;
    } catch (error: any) {
      const pageError = pageHtml ? detectAliExpressPageError(pageHtml, pageTitle) : null;
      if (pageError) {
        throw new Error(pageError);
      }
      throw error;
    }

    for (const [key, value] of bootstrapCookies.entries()) {
      if (!cookies.has(key)) {
        cookies.set(key, value);
      }
    }

    const title = cleanupTitle(
      result?.TITLE?.subject
      || result?.GLOBAL_DATA?.globalData?.subject
      || pageTitle
    );
    if (!title || title.length < 3) {
      throw new Error(`AliExpress extraction failed. Missing product title for ${url}.`);
    }

    // ─── NEW: Enhanced image extraction with 15 strategies ──────────────────
    const apiGallery = this.extractGallery(result);
    const htmlGallery = pageHtml ? extractAliExpressImages(pageHtml) : [];
    const embeddedData = pageHtml ? extractAliExpressEmbeddedData(pageHtml) : null;
    const embeddedGallery = embeddedData ? extractImagesFromObject(embeddedData).filter((u: string) => u.startsWith("http")) : [];

    const allImages = new Set<string>([
      ...apiGallery,
      ...htmlGallery,
      ...embeddedGallery,
    ]);
    const gallery = [...allImages];

    // ZERO-FAILURE: Never throw on missing images
    const finalGallery = gallery.length > 0 ? gallery : [PLACEHOLDER_IMAGE];
    console.log(`[AliExpressExtractor] Final image count: ${finalGallery.length} (API: ${apiGallery.length}, HTML: ${htmlGallery.length}, Embedded: ${embeddedGallery.length}, placeholder: ${gallery.length === 0})`);

    const resolvedPrice = resolveAliPrice(result, pageHtml);
    const price = resolvedPrice.price;
    if (isNaN(price)) {
      throw new Error(`AliExpress extraction failed. Missing product price for ${url}.`);
    }

    const compareAtPrice = resolvedPrice.compareAtPrice;
    const currency = resolvedPrice.currency;

    const descUrl = normalizeText(result?.DESC?.pcDescUrl || result?.DESC?.msiteDescUrl || result?.DESC?.nativeDescUrl);
    const description = normalizeText(
      await this.fetchDescription(descUrl, cleanUrl, cookies)
      || flattenPreContent(result?.DESC?.preContent)
      || result?.DESC?.sellingPointInfo?.title
      || extractMetaContent(pageHtml, "description")
      || extractMetaContent(pageHtml, "og:description")
    );
    if (!description || description.length < 10) {
      throw new Error(`AliExpress extraction failed. Missing product description for ${url}.`);
    }

    const vendor = normalizeText(
      result?.GLOBAL_DATA?.globalData?.storeName
      || result?.SELLER?.storeName
      || result?.SELLER?.companyName
      || "AliExpress"
    );

    const variants = this.extractVariants(result, price);
    const specifications = this.extractSpecifications(result);
    const availability = variants.some((variant) => variant.inventory === undefined || variant.inventory > 0);

    const product: NormalizedProduct = {
      title,
      description,
      images: finalGallery[0],
      gallery: finalGallery,
      variants,
      specifications,
      vendor,
      price,
      compare_at_price: typeof compareAtPrice === "number" && !isNaN(compareAtPrice) ? compareAtPrice : undefined,
      currency,
      availability,
    };

    console.log(`[AliExpressExtractor] Successfully parsed AliExpress product: ${title} | Images: ${finalGallery.length} | Price: ${price} ${currency}`);
    return product;
  }
}
