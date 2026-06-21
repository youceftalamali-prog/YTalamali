import { IProductExtractor } from "./base.ts";
import { ShopifyExtractor } from "./shopify.ts";
import { WooCommerceExtractor } from "./woocommerce.ts";
import { AmazonExtractor } from "./amazon.ts";
import { AliExpressExtractor } from "./aliexpress.ts";
import { AlibabaExtractor } from "./alibaba.ts";
import { EBayExtractor } from "./ebay.ts";

export class ExtractorFactory {
  public static getExtractor(url: string): IProductExtractor {
    const lowerUrl = url.toLowerCase();

    if (lowerUrl.includes("shopify") || lowerUrl.includes("myshopify") || lowerUrl.includes("/products/")) {
      return new ShopifyExtractor();
    }
    if (lowerUrl.includes("woocommerce") || lowerUrl.includes("woo.") || lowerUrl.includes("wc-")) {
      return new WooCommerceExtractor();
    }
    if (lowerUrl.includes("amazon.") || lowerUrl.includes("amzn.")) {
      return new AmazonExtractor();
    }
    if (lowerUrl.includes("aliexpress.")) {
      return new AliExpressExtractor();
    }
    if (lowerUrl.includes("alibaba.")) {
      return new AlibabaExtractor();
    }
    if (lowerUrl.includes("ebay.")) {
      return new EBayExtractor();
    }

    // Default fallback to Shopify extractor
    return new ShopifyExtractor();
  }
}
