import { NormalizedProduct, ProductAnalysis } from "../../src/types.ts";
import { AIProviderService } from "./provider.ts";

function getMarketingSeed(product: NormalizedProduct, analysis: ProductAnalysis | null): string[] {
  return analysis?.marketingIntelligence?.benefits?.slice(0, 3)
    || Object.entries(product.specifications || {}).slice(0, 3).map(([key, value]) => `${key}: ${String(value)}`);
}

function buildFallbackContentPackage(
  product: NormalizedProduct,
  analysis: ProductAnalysis | null,
  contentType: "hooks" | "scripts" | "package"
) {
  const benefits = getMarketingSeed(product, analysis);
  const primaryBenefit = benefits[0] || `${product.title} delivers a more premium product experience.`;
  const positioning = analysis?.brandIntelligence?.brandPositioning?.valueProposition
    || `${product.title} is positioned as a cleaner, more premium option in its category.`;
  const hookSet = [
    { type: "viral", content: `The ${product.title} upgrade shoppers instantly notice.` },
    { type: "problem", content: `Still settling for generic versions of ${product.title}?` },
    { type: "curiosity", content: `What makes this ${product.title} feel premium at first glance?` },
    { type: "emotional", content: `Buy the version that feels as good as it looks.` },
    { type: "direct_response", content: `Discover ${product.title} with premium positioning and clearer value.` },
    { type: "ugc", content: `I was not planning to talk about this, but this ${product.title} surprised me.` },
  ];

  const scripts = [
    "tiktok",
    "ugc",
    "reels",
    "facebook",
    "shorts",
  ].map((type) => ({
    type,
    title: `${product.title} ${type} script`,
    hook: hookSet[0].content,
    problem: `Most listings fail to show why ${product.title} is worth choosing.`,
    solution: `Show ${product.title} with premium visuals, clean proof, and ${primaryBenefit}.`,
    benefits: `${primaryBenefit} ${positioning}`,
    cta: `Tap to shop ${product.title} now.`,
  }));

  const packagePayload = {
    hooks: [
      ...hookSet,
      ...hookSet.map((item, index) => ({
        ...item,
        content: `${item.content} Variation ${index + 1} for ${product.title}.`,
      })),
      ...hookSet.map((item, index) => ({
        ...item,
        content: `${item.content} Fast-scroll version ${index + 1}.`,
      })),
      ...hookSet.map((item, index) => ({
        ...item,
        content: `${item.content} Premium angle ${index + 1}.`,
      })),
    ].slice(0, 20),
    scripts,
    adCopy: [
      { platform: "facebook", format: "short", text: `${product.title} gives buyers a premium reason to choose now.` },
      { platform: "instagram", format: "medium", text: `Meet ${product.title}. ${primaryBenefit} with cleaner visuals, sharper positioning, and stronger purchase confidence.` },
      { platform: "tiktok", format: "short", text: `This ${product.title} looks premium because it is positioned that way from the first second.` },
      { platform: "google", format: "long", text: `Shop ${product.title}. ${positioning} Built for better conversion with premium product storytelling.` },
    ],
    descriptions: {
      short: `${product.title} is built for shoppers who want a more premium, clearer buying experience.`,
      long: `${product.title}\n\nBenefits:\n- ${primaryBenefit}\n- ${benefits[1] || "Premium visual trust-building"}\n- ${benefits[2] || "Cleaner product differentiation"}`,
      seo: `Meta Title: ${product.title} | Meta Description: Shop ${product.title} with premium positioning and clearer value. | Keywords: ${product.title}, premium ${product.vendor}, ecommerce product | Content: ${positioning}`,
    },
    emails: [
      { type: "welcome", subject: `Welcome to ${product.vendor || product.title}`, body: `Thanks for discovering ${product.title}. Expect premium product storytelling, cleaner visuals, and sharper value from here on out.` },
      { type: "promotional", subject: `${product.title} is ready to convert`, body: `Lead with ${primaryBenefit} and remind buyers why ${product.title} stands out right now.` },
      { type: "abandoned_cart", subject: `Still thinking about ${product.title}?`, body: `Here is the quick reminder: ${positioning} Come back and complete your purchase when you are ready.` },
      { type: "launch_campaign", subject: `${product.title} just dropped`, body: `The premium version is live. Discover ${product.title} and see why the buying experience feels sharper from the first click.` },
    ],
    landingPage: {
      headline: `${product.title} with premium clarity`,
      subheadline: positioning,
      benefits: [
        primaryBenefit,
        benefits[1] || "Stronger visual trust from the first impression",
        benefits[2] || "A clearer premium buying story",
      ],
      features: [
        { name: "Premium positioning", description: "Built to feel elevated in a crowded category." },
        { name: "Visual trust", description: "Communicates value quickly with clean product storytelling." },
      ],
      objections: [
        { objection: "Why this over alternatives?", answer: `Because ${product.title} is framed around clearer premium value and stronger proof.` },
      ],
      faq: [
        { question: `What makes ${product.title} different?`, answer: "A cleaner, more confident product story backed by visual proof." },
        { question: "Who is it for?", answer: "Shoppers who want less friction and stronger confidence when buying." },
      ],
      cta: `Shop ${product.title} now`,
    },
  };

  if (contentType === "hooks") {
    return { hooks: packagePayload.hooks.slice(0, 24) };
  }

  if (contentType === "scripts") {
    return { scripts };
  }

  return packagePayload;
}

export class ContentGenerator {
  public static async generate(
    product: NormalizedProduct,
    analysis: ProductAnalysis | null,
    contentType: "hooks" | "scripts" | "package",
    languageCode: string = "en"
  ): Promise<any> {
    const systemInstruction = `You are an elite, world-class growth-hacking copywriter, expert in conversion rate optimization (CRO) and e-commerce marketing.
Your goal is to transform the provided product details and intelligence insights into production-ready, high-converting marketing copy in a strict JSON format.
All output copy must be fully written in the requested language code: "${languageCode}". It must sound natural, captivating, and highly persuasive.
DO NOT use placeholder text, mock information, or lorem ipsum. Fill every section with real, actionable, highly relevant, and engaging content tailored to the specific product assets.`;

    let prompt = `Analyze this product and any associated intelligence indicators, and write direct-response copy that sells.

PRODUCT INFORMATION:
Title: ${product.title}
Brand/Vendor: ${product.vendor}
Price: ${product.price} ${product.currency}
Description: ${product.description || "N/A"}
Specifications: ${JSON.stringify(product.specifications || {})}
`;

    if (analysis) {
      prompt += `
MARKETING INTELLIGENCE FOUNDATION:
Benefits discovered: ${JSON.stringify(analysis.marketingIntelligence?.benefits || [])}
Emotional triggers: ${JSON.stringify(analysis.marketingIntelligence?.emotionalTriggers || [])}
Customer Pain points: ${JSON.stringify(analysis.marketingIntelligence?.painPoints || [])}
Key Selling Angles: ${JSON.stringify(analysis.marketingIntelligence?.sellingAngles || [])}
Common Objections & Refutations: ${JSON.stringify(analysis.marketingIntelligence?.objections || [])}
Brand voice essence: ${analysis.brandIntelligence?.brandVoiceAnalyzer?.essence || "N/A"}
Messaging pillars: ${JSON.stringify(analysis.brandIntelligence?.brandVoiceAnalyzer?.messagingPillars || [])}
Preferred vocabulary: ${JSON.stringify(analysis.brandIntelligence?.brandVoiceAnalyzer?.vocabulary || [])}
Primary tone of voice: ${analysis.brandIntelligence?.toneOfVoiceAnalysis?.primaryTone || "N/A"}
Writing guidelines: ${JSON.stringify(analysis.brandIntelligence?.toneOfVoiceAnalysis?.writingGuidelines || [])}
Brand promise: ${analysis.brandIntelligence?.brandPositioning?.brandPromise || "N/A"}
Value proposition: ${analysis.brandIntelligence?.brandPositioning?.valueProposition || "N/A"}
`;
    }

    let schemaDescription = "";

    if (contentType === "hooks") {
      prompt += `
TASK: Generate exactly 24 hooks in total (4 of each of the following 6 types):
1. 'viral' - high engagement, scroll-stopping hooks for TikTok/Reels trend videos
2. 'problem' - starts directly with a massive pain point or symptom solved by the product
3. 'curiosity' - triggers an information gap, making the user look further
4. 'emotional' - targets status, relief, belonging, or frustration
5. 'direct_response' - ultra-clear, offer-based or immediate benefit hooks
6. 'ugc' - raw, creator-style, speaking-to-camera styled openings (e.g. "Okay so I never make videos but...")

Make them punchy, short, and optimized for immediate vertical video retention.
`;
      schemaDescription = `Return a JSON object with this exact structure:
{
  "hooks": [
    { "type": "viral" | "problem" | "curiosity" | "emotional" | "direct_response" | "ugc", "content": "compelling hook content" }
  ]
}`;
    } else if (contentType === "scripts") {
      prompt += `
TASK: Generate exactly 5 distinct shortform video scripts, one for each platform:
1. 'tiktok' - high energy, trend-focused, rapid cuts, visually dense
2. 'ugc' - organic review, relatable aesthetic, casual creator tone
3. 'reels' - visually appealing, aspirational, style-focused
4. 'facebook' - social-proof heavy, family/convenience-focused, clear benefits
5. 'shorts' - rapid pacing, informative, loop-designed back to the hook

Each script MUST consist of 5 defined sections:
- Hook (0-3s scroll-stopper)
- Problem (identifying the user friction)
- Solution (introducing the product naturally)
- Benefits (tangible relief and advantages)
- CTA (clear next action, e.g. "tap link to shop")
`;
      schemaDescription = `Return a JSON object with this exact structure:
{
  "scripts": [
    {
      "type": "tiktok" | "ugc" | "reels" | "facebook" | "shorts",
      "title": "unique creative script title",
      "hook": "hook text dialog/action directions",
      "problem": "problem text dialog/action directions",
      "solution": "solution text dialog/action directions",
      "benefits": "benefits text dialog/action directions",
      "cta": "cta text with action guidelines"
    }
  ]
}`;
    } else {
      // Content Package
      prompt += `
TASK: Generate a complete comprehensive content conversion package containing:
1. HOOKS: Exactly 20 hooks in total (matching viral, problem, curiosity, emotional, direct_response, ugc).
2. SCRIPTS: 5 shortform scripts (for tiktok, ugc, reels, facebook, shorts) each with Hook, Problem, Solution, Benefits, CTA.
3. AD COPY: Ad creative text copies for 4 platforms (facebook, instagram, tiktok, google) across 3 styles ('short', 'medium', 'long').
4. PRODUCT DESCRIPTIONS: 3 formats: 'short' (1-2 sentences with punch), 'long' (bulleted benefits, feature descriptions), and 'seo' (optimized with keywords and meta title/descriptions).
5. EMAIL MARKETING: 4 automated emails: 'welcome' (onboarding/on-brand), 'promotional' (scarcity, urgency, benefit), 'abandoned_cart' (clearing friction, offering help), and 'launch_campaign' (announcement, high energy).
6. LANDING PAGE: Standard high-converting landing page skeleton including Headline, Subheadline, list of Benefits, list of Features, list of customer Objections refuted, a 5-item FAQ, and clear CTAs.
`;
      schemaDescription = `Return a JSON object with this exact structure:
{
  "hooks": [
    { "type": "viral" | "problem" | "curiosity" | "emotional" | "direct_response" | "ugc", "content": "..." }
  ],
  "scripts": [
    {
      "type": "tiktok" | "ugc" | "reels" | "facebook" | "shorts",
      "title": "script title",
      "hook": "...",
      "problem": "...",
      "solution": "...",
      "benefits": "...",
      "cta": "..."
    }
  ],
  "adCopy": [
    { "platform": "facebook" | "instagram" | "tiktok" | "google", "format": "short" | "medium" | "long", "text": "..." }
  ],
  "descriptions": {
    "short": "...",
    "long": "...",
    "seo": "Meta Title: ... | Meta Description: ... | Keywords: ... | Content: ..."
  },
  "emails": [
    { "type": "welcome" | "promotional" | "abandoned_cart" | "launch_campaign", "subject": "...", "body": "..." }
  ],
  "landingPage": {
    "headline": "...",
    "subheadline": "...",
    "benefits": ["...", "...", "..."],
    "features": [
      { "name": "...", "description": "..." }
    ],
    "objections": [
      { "objection": "...", "answer": "..." }
    ],
    "faq": [
      { "question": "...", "answer": "..." }
    ],
    "cta": "..."
  }
}`;
    }

    prompt += `
Your response MUST be strict valid JSON matching the schema requirements. Any text should be optimized to drive conversions and sales. Do not wrap outer response in markdown fences. Only raw JSON is allowed.`;

    try {
      const response = await AIProviderService.generateJSON(
        prompt,
        systemInstruction,
        schemaDescription,
        {
          workflow: "standard",
          temperature: 0.25,
        }
      );
      return AIProviderService.cleanAndParseJSON(response.rawContent);
    } catch (err) {
      console.warn("[Content Generator] Falling back to local deterministic content package:", err);
      return buildFallbackContentPackage(product, analysis, contentType);
    }
  }
}
