export interface ProductVariant {
  id: string;
  title: string;
  price: string;
  sku?: string;
  inventory?: number;
}

export interface NormalizedProduct {
  id?: string;
  title: string;
  description: string;
  images: string; // main thumbnail URL
  gallery: string[]; // array of secondary image URLs
  variants: ProductVariant[];
  specifications: Record<string, string>;
  vendor: string;
  price: number;
  compare_at_price?: number;
  currency: string;
  availability: boolean;
  isFallback?: boolean;
  isPartial?: boolean;
  createdAt?: string;
}

export interface Workspace {
  id: string;
  name: string;
  credits: number;
  plan?: SubscriptionPlanName;
  subscriptionStatus?: SubscriptionStatus;
  billingInterval?: SubscriptionInterval;
  trialEndsAt?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  stripeCustomerId?: string;
  stripeMode?: "sandbox" | "live";
  creditPools?: WorkspaceCreditSummary;
}

export type SubscriptionPlanName = "free" | "starter" | "pro" | "enterprise";
export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid";
export type SubscriptionInterval = "monthly" | "yearly";
export type CreditBucketName = "ai" | "video" | "publishing";

export interface WorkspaceCreditBucket {
  bucket: CreditBucketName;
  label: string;
  balance: number;
  monthlyAllocation: number;
  usedThisPeriod: number;
}

export interface WorkspaceCreditSummary {
  ai: WorkspaceCreditBucket;
  video: WorkspaceCreditBucket;
  publishing: WorkspaceCreditBucket;
  totalBalance: number;
  totalMonthlyAllocation: number;
  totalUsedThisPeriod: number;
}

export interface BillingPlanDefinition {
  id: SubscriptionPlanName;
  label: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  aiCredits: number;
  videoCredits: number;
  publishingCredits: number;
  trialDays: number;
  features: string[];
  stripePriceIds?: Partial<Record<SubscriptionInterval, string>>;
}

export interface WorkspaceSubscription {
  id: string;
  workspaceId: string;
  plan: SubscriptionPlanName;
  status: SubscriptionStatus;
  billingInterval: SubscriptionInterval;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePortalUrl?: string;
  stripeCheckoutSessionId?: string;
  stripeMode: "sandbox" | "live";
  trialEndsAt?: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BillingInvoice {
  id: string;
  workspaceId: string;
  subscriptionId?: string;
  stripeInvoiceId?: string;
  amountPaid: number;
  currency: string;
  status: "draft" | "open" | "paid" | "void" | "uncollectible";
  hostedInvoiceUrl?: string;
  invoicePdfUrl?: string;
  createdAt: string;
}

export interface PaymentHistoryItem {
  id: string;
  workspaceId: string;
  invoiceId?: string;
  stripePaymentIntentId?: string;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "refunded";
  paymentMethod: string;
  description: string;
  createdAt: string;
}

export interface BillingAnalytics {
  mrr: number;
  arr: number;
  churnRate: number;
  activeSubscriptions: number;
  trialingSubscriptions: number;
  revenueByPlan: Array<{
    plan: SubscriptionPlanName;
    revenue: number;
    workspaces: number;
  }>;
}

export interface BillingOverview {
  workspace: Workspace;
  subscription: WorkspaceSubscription;
  plans: BillingPlanDefinition[];
  invoices: BillingInvoice[];
  payments: PaymentHistoryItem[];
  analytics: BillingAnalytics;
}

export type ShopifyStoreStatus = "connected" | "needs_reauth" | "disconnected";
export type ShopifySyncStatus = "pending" | "syncing" | "completed" | "failed";
export type ShopifySyncScope =
  | "products"
  | "collections"
  | "inventory"
  | "orders"
  | "customers"
  | "webhook";
export type ShopifyWebhookTopic =
  | "products/create"
  | "products/update"
  | "products/delete"
  | "orders/create"
  | "orders/updated"
  | "app/uninstalled";
export type ShopifySyncTrigger = "manual" | "automation" | "webhook";

export interface ShopifyStoreConnection {
  id: string;
  workspaceId: string;
  shopDomain: string;
  shopName: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  lastTokenRefreshAt?: string;
  scopes: string[];
  status: ShopifyStoreStatus;
  connectionMode: "sandbox" | "live";
  isDefault: boolean;
  connectedAt: string;
  updatedAt: string;
  lastSyncedAt?: string;
}

export interface ShopifySyncJob {
  id: string;
  workspaceId: string;
  storeId: string;
  scope: ShopifySyncScope;
  status: ShopifySyncStatus;
  trigger: ShopifySyncTrigger;
  webhookTopic?: ShopifyWebhookTopic;
  entityId?: string;
  summary: string;
  syncedProducts: number;
  syncedCollections: number;
  syncedInventory: number;
  importedOrders: number;
  importedCustomers: number;
  revenueImported: number;
  automationExecutions: number;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShopifyWebhookEvent {
  id: string;
  workspaceId: string;
  storeId: string;
  topic: ShopifyWebhookTopic;
  status: ShopifySyncStatus;
  payload: Record<string, unknown>;
  syncJobId?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface ShopifyAutomationSettings {
  id: string;
  workspaceId: string;
  storeId: string;
  autoSyncEveryHour: boolean;
  autoPublishGeneratedContent: boolean;
  autoCreateSocialPosts: boolean;
  autoGenerateVideos: boolean;
  autoCompetitorMonitoring: boolean;
  lastAutoSyncAt?: string;
  lastAutomationRunAt?: string;
  updatedAt: string;
}

export interface ShopifyAutomationRun {
  id: string;
  workspaceId: string;
  storeId: string;
  action:
    | "auto_sync"
    | "auto_publish_generated_content"
    | "auto_create_social_posts"
    | "auto_generate_videos"
    | "auto_competitor_monitoring";
  status: ShopifySyncStatus;
  detail: string;
  productId?: string;
  createdAt: string;
}

export interface ShopifySyncAnalytics {
  connectedStores: number;
  syncedProducts: number;
  ordersImported: number;
  revenueImported: number;
  syncFailures: number;
  automationExecutions: number;
}

export interface ShopifySyncOverview {
  stores: ShopifyStoreConnection[];
  jobs: ShopifySyncJob[];
  queue: ShopifySyncJob[];
  webhooks: ShopifyWebhookEvent[];
  automationSettings: ShopifyAutomationSettings[];
  automationRuns: ShopifyAutomationRun[];
  analytics: ShopifySyncAnalytics;
}

export type QueueJobKind =
  | "product_import"
  | "shopify_sync"
  | "ai_content_generation"
  | "ai_video_rendering"
  | "social_publishing"
  | "automation_execution"
  | "competitor_monitoring";

export type QueueWorkerName =
  | "import-worker"
  | "shopify-worker"
  | "content-worker"
  | "video-worker"
  | "publishing-worker"
  | "automation-worker";

export type QueueJobStatus =
  | "pending"
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "retrying"
  | "cancelled";

export interface QueueJobRecord {
  id: string;
  workspaceId: string;
  kind: QueueJobKind;
  workerName: QueueWorkerName;
  status: QueueJobStatus;
  referenceId?: string;
  payload: Record<string, unknown>;
  priority: number;
  attemptCount: number;
  maxAttempts: number;
  backoffMs: number;
  nextRunAt: string;
  lockedAt?: string;
  lastError?: string;
  deadLetterReason?: string;
  processingTimeMs?: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface QueueJobLog {
  id: string;
  jobId: string;
  workspaceId: string;
  status: QueueJobStatus;
  message: string;
  workerName: QueueWorkerName;
  createdAt: string;
}

export interface DeadLetterJob {
  id: string;
  sourceJobId: string;
  workspaceId: string;
  kind: QueueJobKind;
  workerName: QueueWorkerName;
  payload: Record<string, unknown>;
  attempts: number;
  lastError: string;
  movedAt: string;
}

export interface WorkerHealthSnapshot {
  workerName: QueueWorkerName;
  status: "idle" | "running" | "offline";
  activeJobId?: string;
  memoryUsageMb: number;
  queueLength: number;
  failedJobs: number;
  processedJobs: number;
  averageProcessingTimeMs: number;
  lastHeartbeatAt: string;
}

export interface QueueAnalytics {
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  throughputPerHour: number;
  averageExecutionTimeMs: number;
  queueLengthByKind: Array<{
    kind: QueueJobKind;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }>;
}

export interface QueueOverview {
  jobs: QueueJobRecord[];
  activeJobs: QueueJobRecord[];
  completedJobs: QueueJobRecord[];
  failedJobs: QueueJobRecord[];
  workers: WorkerHealthSnapshot[];
  deadLetterJobs: DeadLetterJob[];
  analytics: QueueAnalytics;
}

export interface ImportOperation {
  id: string;
  workspaceId: string;
  provider: string;
  sourceUrl: string;
  status: "pending" | "success" | "failed";
  creditCharged: number;
  errorMessage?: string;
  createdAt: string;
  productId?: string;
}

export interface AuditLog {
  id: string;
  workspaceId: string;
  action: string;
  details: string;
  createdAt: string;
}

// --- Product Intelligence types ---

export interface OpportunityScore {
  overall: number;
  demand: number;
  competition: number;
  trend: number;
  profitability: number;
}

export interface MarketAudience {
  personaName: string;
  rationale: string;
}

export interface AdPlatform {
  platform: string;
  format: string;
  justification: string;
}

export interface PricingPlan {
  msrp: number;
  lowestAestheticBound: number;
  premiumVibeBound: number;
  currency: string;
}

export interface MarketIntelligence {
  bestCountries: string[];
  bestAudiences: MarketAudience[];
  bestAdPlatforms: AdPlatform[];
  suggestedPricing: PricingPlan;
}

export interface ObjectionAngle {
  objection: string;
  refutationAngle: string;
}

export interface MarketingIntelligence {
  benefits: string[];
  objections: ObjectionAngle[];
  emotionalTriggers: string[];
  painPoints: string[];
  sellingAngles: string[];
}

export interface BrandVoiceAnalyzer {
  archetype: string;
  essence: string;
  differentiators: string[];
  messagingPillars: string[];
  vocabulary: string[];
  signaturePhrases: string[];
  doSay: string[];
  avoidSay: string[];
}

export interface CompetitorBrandAnalysis {
  competitorName: string;
  positioning: string;
  audience: string;
  toneOfVoice: string;
  strengths: string[];
  weaknesses: string[];
  whitespace: string;
}

export interface BrandPositioning {
  category: string;
  targetAudience: string;
  brandPromise: string;
  valueProposition: string;
  differentiators: string[];
  reasonToBelieve: string[];
  marketWhitespace: string[];
  elevatorPitch: string;
}

export interface CustomerPersona {
  personaName: string;
  demographics: string;
  psychographics: string;
  coreNeeds: string[];
  painPoints: string[];
  buyingTriggers: string[];
  preferredChannels: string[];
  preferredContentAngles: string[];
}

export interface ToneSlider {
  dimension: string;
  score: number;
  guidance: string;
}

export interface ToneOfVoiceAnalysis {
  primaryTone: string;
  secondaryTones: string[];
  tonalSliders: ToneSlider[];
  writingGuidelines: string[];
  avoidedPatterns: string[];
}

export interface BrandIdentityGenerator {
  brandName: string;
  tagline: string;
  mission: string;
  vision: string;
  coreValues: string[];
  personalityTraits: string[];
  visualDirection: string[];
  colorMood: string[];
  typographyStyle: string;
  imageryDirection: string;
}

export interface BrandIntelligence {
  brandVoiceAnalyzer: BrandVoiceAnalyzer;
  competitorBrandAnalysis: CompetitorBrandAnalysis[];
  brandPositioning: BrandPositioning;
  customerPersonaGeneration: CustomerPersona[];
  toneOfVoiceAnalysis: ToneOfVoiceAnalysis;
  brandIdentityGenerator: BrandIdentityGenerator;
}

export interface AdConcept {
  conceptName: string;
  hookId: number;
  description: string;
}

export interface VideoConcept {
  durationSeconds: number;
  visualFlow: string;
  audioDialogue: string;
}

export interface CreativeIntelligence {
  hooks: string[];
  adConcepts: AdConcept[];
  ugcIdeas: string[];
  videoConcepts: VideoConcept[];
}

export interface ProductAnalysis {
  id: string;
  productId: string;
  workspaceId: string;
  version: number;
  isLatest: boolean;
  languageCode: string;
  confidenceScore: number;
  aiProvider: string;
  aiModel: string;
  promptTokensCount?: number;
  completionTokensCount?: number;
  latencyMilliseconds?: number;
  opportunityScores: OpportunityScore;
  marketIntelligence: MarketIntelligence;
  marketingIntelligence: MarketingIntelligence;
  brandIntelligence: BrandIntelligence;
  creativeIntelligence: CreativeIntelligence;
  createdAt: string;
}

export interface CreditLedgerEntry {
  id: string;
  workspaceId: string;
  transactionType:
    | "subscription_allocation"
    | "bonus_credit"
    | "ingest_consume"
    | "analysis_consume"
    | "copy_consume"
    | "video_consume"
    | "publishing_consume"
    | "plan_change"
    | "payment"
    | "refund";
  amount: number;
  runningBalance: number;
  creditBucket?: CreditBucketName;
  referenceId?: string;
  description?: string;
  createdAt: string;
}

export interface ContentGenerationRecord {
  id: string;
  productId: string;
  workspaceId: string;
  contentType: string;
  creditsCharged: number;
  payload: Record<string, unknown>;
  version: number;
  isLatest: boolean;
  createdAt: string;
}

export type SocialPlatform =
  | "facebook"
  | "instagram"
  | "tiktok"
  | "pinterest"
  | "x"
  | "linkedin"
  | "youtube_shorts";

export type SocialPostStatus =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed";

export interface SocialAccount {
  id: string;
  workspaceId: string;
  platform: SocialPlatform;
  platformUserId: string;
  username: string;
  avatarUrl?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  integrationMode: "sandbox" | "live";
  status: "connected" | "needs_reauth";
  connectedAt: string;
}

export interface SocialPostMetrics {
  engagement: number;
  reach: number;
  clicks: number;
  impressions: number;
}

export interface SocialPost {
  id: string;
  batchId: string;
  workspaceId: string;
  productId: string;
  socialAccountId?: string;
  platform: SocialPlatform;
  title: string;
  caption: string;
  hashtags: string[];
  mediaUrls: string[];
  status: SocialPostStatus;
  scheduledAt?: string;
  publishedAt?: string;
  externalPostId?: string;
  previewText: string;
  sourceType?: string;
  sourceGenerationId?: string;
  failureReason?: string;
  metrics: SocialPostMetrics;
  createdAt: string;
  updatedAt: string;
}

export interface SocialContentSuggestion {
  id: string;
  label: string;
  text: string;
  type: "hook" | "script" | "ad_copy" | "description" | "email" | "landing_page";
}

export interface SocialPublishingAnalytics {
  publishedPosts: number;
  scheduledPosts: number;
  draftPosts: number;
  failedPosts: number;
  engagement: number;
  reach: number;
  clicks: number;
  platformPerformance: Array<{
    platform: SocialPlatform;
    posts: number;
    engagement: number;
    reach: number;
    clicks: number;
  }>;
}

export type VideoProviderName = "google_veo" | "runwayml" | "kling_ai" | "pika_labs";
export type VideoTemplateName =
  | "product_showcase"
  | "ugc_testimonial"
  | "problem_solution"
  | "before_after"
  | "unboxing"
  | "luxury_brand_ad"
  | "storytelling_ad";
export type VideoInputMode = "product_data" | "text_prompt" | "product_images";
export type VideoAspectRatio = "9:16" | "16:9" | "1:1";
export type VideoRenderStatus = "draft" | "queued" | "rendering" | "completed" | "failed";
export type VideoOutputType =
  | "ugc_style_ad"
  | "slideshow"
  | "talking_avatar"
  | "short_form_vertical"
  | "long_form_promotional";

export interface VideoScene {
  title: string;
  visual: string;
  narration: string;
  durationSeconds: number;
}

export interface ProviderHealthMetric {
  provider: VideoProviderName;
  status: "available" | "degraded";
  averageRenderTime: number;
  successRate: number;
  mode: "sandbox" | "live";
}

export interface VideoGenerationRecord {
  id: string;
  productId: string;
  workspaceId: string;
  version: number;
  isLatest: boolean;
  template: VideoTemplateName;
  outputType: VideoOutputType;
  inputMode: VideoInputMode;
  prompt: string;
  provider: VideoProviderName;
  providerFallbackChain: VideoProviderName[];
  aspectRatio: VideoAspectRatio;
  durationSeconds: number;
  status: VideoRenderStatus;
  progress: number;
  creditsUsed: number;
  estimatedRenderSeconds: number;
  sourceGenerationId?: string;
  sourceAnalysisId?: string;
  sourceImageUrls: string[];
  title: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  downloadUrl?: string;
  errorMessage?: string;
  scenes: VideoScene[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface VideoStudioAnalytics {
  generatedVideos: number;
  completedVideos: number;
  failedVideos: number;
  averageRenderTime: number;
  creditsUsed: number;
  providerPerformance: ProviderHealthMetric[];
}

export type AnalyticsDatePreset = "today" | "7d" | "30d" | "90d" | "custom";

export interface AnalyticsDateRange {
  preset: AnalyticsDatePreset;
  label: string;
  startDate: string;
  endDate: string;
  previousStartDate: string;
  previousEndDate: string;
}

export interface AnalyticsKpi {
  id: string;
  label: string;
  value: number;
  change: number;
  helper: string;
  format: "currency" | "percent" | "number";
}

export interface AnalyticsTimeseriesPoint {
  date: string;
  label: string;
  revenue: number;
  conversions: number;
  traffic: number;
  engagement: number;
  roi: number;
  growth: number;
  opportunity: number;
}

export interface AnalyticsDistributionItem {
  label: string;
  value: number;
  share: number;
}

export interface ProductPerformanceItem {
  productId: string;
  title: string;
  vendor: string;
  revenue: number;
  conversions: number;
  traffic: number;
  engagementRate: number;
  roi: number;
  opportunityScore: number;
}

export interface CompetitorAnalyticsItem {
  competitorName: string;
  positioning: string;
  toneOfVoice: string;
  audience: string;
  threatScore: number;
  whitespaceScore: number;
}

export interface SocialAnalyticsItem {
  title: string;
  metric: number;
  detail: string;
}

export interface OpportunityAnalyticsItem {
  productId: string;
  title: string;
  overall: number;
  demand: number;
  trend: number;
  profitability: number;
  confidence: number;
  recommendation: string;
}

export interface AdvancedAnalyticsPayload {
  dateRange: AnalyticsDateRange;
  selectedProductId?: string;
  kpis: AnalyticsKpi[];
  revenueTrend: AnalyticsTimeseriesPoint[];
  topProducts: ProductPerformanceItem[];
  trafficSources: AnalyticsDistributionItem[];
  competitorAnalytics: CompetitorAnalyticsItem[];
  socialMediaAnalytics: SocialAnalyticsItem[];
  opportunityAnalytics: OpportunityAnalyticsItem[];
  salesAnalytics: {
    totalSales: number;
    averageOrderValue: number;
    repeatCustomers: number;
    sellThroughRate: number;
  };
  revenueAnalytics: {
    grossRevenue: number;
    netRevenue: number;
    roi: number;
    growthRate: number;
  };
  conversionAnalytics: {
    conversionRate: number;
    cartToCheckoutRate: number;
    checkoutToPurchaseRate: number;
    leadsCaptured: number;
  };
  trafficAnalytics: {
    sessions: number;
    uniqueVisitors: number;
    returningVisitors: number;
    bounceRate: number;
  };
  productPerformanceAnalytics: {
    topPerformers: ProductPerformanceItem[];
  };
  competitorSectionAnalytics: {
    trackedCompetitors: number;
    averageThreatScore: number;
    whitespaceCoverage: number;
  };
  socialSectionAnalytics: {
    engagementRate: number;
    topPlatform: string;
    totalMentions: number;
    topHook: string;
  };
  opportunityScoreAnalytics: {
    averageOpportunityScore: number;
    bestProductTitle: string;
    bestOpportunityScore: number;
  };
}

export function createEmptyBrandIntelligence(brandName: string = "Brand"): BrandIntelligence {
  return {
    brandVoiceAnalyzer: {
      archetype: "Emerging authority",
      essence: `${brandName} is still building a defined voice profile.`,
      differentiators: [],
      messagingPillars: [],
      vocabulary: [],
      signaturePhrases: [],
      doSay: [],
      avoidSay: [],
    },
    competitorBrandAnalysis: [],
    brandPositioning: {
      category: "",
      targetAudience: "",
      brandPromise: "",
      valueProposition: "",
      differentiators: [],
      reasonToBelieve: [],
      marketWhitespace: [],
      elevatorPitch: "",
    },
    customerPersonaGeneration: [],
    toneOfVoiceAnalysis: {
      primaryTone: "",
      secondaryTones: [],
      tonalSliders: [],
      writingGuidelines: [],
      avoidedPatterns: [],
    },
    brandIdentityGenerator: {
      brandName,
      tagline: "",
      mission: "",
      vision: "",
      coreValues: [],
      personalityTraits: [],
      visualDirection: [],
      colorMood: [],
      typographyStyle: "",
      imageryDirection: "",
    },
  };
}
