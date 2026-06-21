import {
  SocialAccount,
  SocialPlatform,
  SocialPost,
  SocialPostMetrics,
} from "../../src/types.ts";

interface PublishResult {
  externalPostId: string;
  publishedAt: string;
  integrationMode: "sandbox" | "live";
  metrics: SocialPostMetrics;
}

const PLATFORM_CONFIG: Record<SocialPlatform, {
  label: string;
  apiBaseUrl: string;
  envTokenKey: string;
}> = {
  facebook: {
    label: "Facebook",
    apiBaseUrl: "https://graph.facebook.com/v19.0",
    envTokenKey: "META_GRAPH_API_TOKEN",
  },
  instagram: {
    label: "Instagram",
    apiBaseUrl: "https://graph.facebook.com/v19.0",
    envTokenKey: "META_GRAPH_API_TOKEN",
  },
  tiktok: {
    label: "TikTok",
    apiBaseUrl: "https://open.tiktokapis.com/v2",
    envTokenKey: "TIKTOK_API_TOKEN",
  },
  pinterest: {
    label: "Pinterest",
    apiBaseUrl: "https://api.pinterest.com/v5",
    envTokenKey: "PINTEREST_API_TOKEN",
  },
  x: {
    label: "X",
    apiBaseUrl: "https://api.twitter.com/2",
    envTokenKey: "X_API_TOKEN",
  },
  linkedin: {
    label: "LinkedIn",
    apiBaseUrl: "https://api.linkedin.com/v2",
    envTokenKey: "LINKEDIN_API_TOKEN",
  },
  youtube_shorts: {
    label: "YouTube Shorts",
    apiBaseUrl: "https://www.googleapis.com/youtube/v3",
    envTokenKey: "YOUTUBE_API_TOKEN",
  },
};

function hashSeed(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) % 100000;
  }
  return hash;
}

function createSyntheticMetrics(post: SocialPost): SocialPostMetrics {
  const seed = hashSeed(`${post.platform}:${post.caption}:${post.id}`);
  return {
    engagement: 40 + (seed % 260),
    reach: 350 + (seed % 2500),
    clicks: 8 + (seed % 140),
    impressions: 500 + (seed % 4000),
  };
}

async function tryLivePublish(post: SocialPost, token: string): Promise<string> {
  const config = PLATFORM_CONFIG[post.platform];
  const endpoint = `${config.apiBaseUrl}/publish`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-AuraPost-Platform": config.label,
    },
    body: JSON.stringify({
      title: post.title,
      caption: post.caption,
      hashtags: post.hashtags,
      mediaUrls: post.mediaUrls,
      scheduledAt: post.scheduledAt,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${config.label} publish failed: ${body || response.statusText}`);
  }

  const data = await response.json() as { id?: string; postId?: string };
  return data.id || data.postId || `${post.platform}_${Date.now()}`;
}

export class SocialPublisherService {
  public static getPlatformConfiguration(platform: SocialPlatform) {
    return PLATFORM_CONFIG[platform];
  }

  public static resolveIntegrationMode(account?: SocialAccount): "sandbox" | "live" {
    const token = account?.accessToken || process.env[PLATFORM_CONFIG[account?.platform || "facebook"].envTokenKey];
    const isLiveEnabled = process.env.SOCIAL_PUBLISH_LIVE === "true";
    return token && isLiveEnabled ? "live" : "sandbox";
  }

  public static async publish(post: SocialPost, account?: SocialAccount): Promise<PublishResult> {
    const token = account?.accessToken || process.env[PLATFORM_CONFIG[post.platform].envTokenKey];
    const integrationMode = token && process.env.SOCIAL_PUBLISH_LIVE === "true" ? "live" : "sandbox";
    const publishedAt = new Date().toISOString();

    if (integrationMode === "live" && token) {
      const externalPostId = await tryLivePublish(post, token);
      return {
        externalPostId,
        publishedAt,
        integrationMode,
        metrics: createSyntheticMetrics(post),
      };
    }

    return {
      externalPostId: `sandbox_${post.platform}_${Date.now()}`,
      publishedAt,
      integrationMode: "sandbox",
      metrics: createSyntheticMetrics(post),
    };
  }
}
