import express from "express";
import path from "path";
import { DatabaseManager } from "./server/db.ts";
import { ExtractorFactory } from "./server/extractors/factory.ts";
import { ProductAnalyzer } from "./server/ai/analyzer.ts";
import { ContentGenerator } from "./server/ai/content-generator.ts";
import { buildAdvancedAnalyticsPayload } from "./server/analytics/dashboard.ts";
import { createCheckoutSession, createCustomerPortalSession, constructStripeWebhookEvent, getStripeMode } from "./server/billing/stripe.ts";
import {
  completeShopifyOAuth,
  enqueueStoreSync,
  handleShopifyWebhook,
  refreshShopifyAccessToken,
  startShopifyOAuth,
} from "./server/shopify/live-sync.ts";
import { SocialPublisherService } from "./server/social/publisher.ts";
import { publishQueuedSocialPost } from "./server/social/queue.ts";
import { QueueEngine } from "./server/queue/engine.ts";
import {
  CreditBucketName,
  QueueJobKind,
  ShopifySyncScope,
  ShopifyWebhookTopic,
  SocialPlatform,
  SocialPostStatus,
  SubscriptionInterval,
  SubscriptionPlanName,
  SubscriptionStatus,
  VideoProviderName,
  VideoTemplateName,
  VideoOutputType,
  VideoInputMode,
  VideoAspectRatio,
} from "./src/types.ts";
import { buildVideoAnalytics, createVideoDraft } from "./server/video/studio.ts";
import { getDefaultFallbackChain, getVideoProviders } from "./server/video/provider.ts";
import { getBillingPlan } from "./server/billing/plans.ts";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  // Middleware
  app.use(express.json({
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
    },
  }));

  // Acquire DB Instance
  const db = await DatabaseManager.getInstance();
  const queueEngine = new QueueEngine(db);
  queueEngine.start();

  const supportedSocialPlatforms: SocialPlatform[] = [
    "facebook",
    "instagram",
    "tiktok",
    "pinterest",
    "x",
    "linkedin",
    "youtube_shorts",
  ];
  const supportedVideoTemplates: VideoTemplateName[] = [
    "product_showcase",
    "ugc_testimonial",
    "problem_solution",
    "before_after",
    "unboxing",
    "luxury_brand_ad",
    "storytelling_ad",
  ];

  const sendInsufficientCredits = (
    res: express.Response,
    workspaceId: string,
    bucket: CreditBucketName,
    requiredCredits: number
  ) => {
    const workspace = db.getWorkspace(workspaceId);
    const availableCredits = workspace?.creditPools?.[bucket].balance || 0;
    const plan = workspace?.plan || "free";
    return res.status(402).json({
      error: `Insufficient ${bucket} credits. This action requires ${requiredCredits} ${bucket} credits.`,
      code: "INSUFFICIENT_CREDITS",
      workspaceId,
      creditBucket: bucket,
      requiredCredits,
      availableCredits,
      currentPlan: plan,
      upgradePrompt: {
        title: `Upgrade from ${plan} to unlock more ${bucket} credits`,
        cta: "Open Billing",
      },
    });
  };

  const buildSocialSuggestions = (payload: Record<string, any>, generationId?: string) => {
    const suggestions: Array<{ id: string; label: string; text: string; type: string; generationId?: string }> = [];

    (payload.hooks || []).forEach((hook: any, index: number) => {
      if (hook?.content) {
        suggestions.push({
          id: `hook-${index}`,
          label: `Hook ${index + 1}`,
          text: hook.content,
          type: "hook",
          generationId,
        });
      }
    });

    (payload.adCopy || []).forEach((copy: any, index: number) => {
      if (copy?.text) {
        suggestions.push({
          id: `ad-${index}`,
          label: `${copy.platform || "Ad"} ${index + 1}`,
          text: copy.text,
          type: "ad_copy",
          generationId,
        });
      }
    });

    (payload.scripts || []).forEach((script: any, index: number) => {
      const scriptText = [script.hook, script.problem, script.solution, script.cta].filter(Boolean).join(" ");
      if (scriptText) {
        suggestions.push({
          id: `script-${index}`,
          label: script.title || `Script ${index + 1}`,
          text: scriptText,
          type: "script",
          generationId,
        });
      }
    });

    if (payload.descriptions?.short) {
      suggestions.push({
        id: "description-short",
        label: "Short Description",
        text: payload.descriptions.short,
        type: "description",
        generationId,
      });
    }

    if (payload.landingPage?.headline) {
      suggestions.push({
        id: "landing-headline",
        label: "Landing Headline",
        text: `${payload.landingPage.headline} ${payload.landingPage.subheadline || ""}`.trim(),
        type: "landing_page",
        generationId,
      });
    }

    return suggestions;
  };

  const enqueueQueueJob = (
    workspaceId: string,
    kind: QueueJobKind,
    referenceId: string | undefined,
    payload: Record<string, unknown>,
    options: {
      workerName: "import-worker" | "shopify-worker" | "content-worker" | "video-worker" | "publishing-worker" | "automation-worker";
      priority?: number;
      maxAttempts?: number;
      backoffMs?: number;
    }
  ) => db.enqueueQueueJob(workspaceId, {
    kind,
    workerName: options.workerName,
    referenceId,
    payload,
    priority: options.priority,
    maxAttempts: options.maxAttempts,
    backoffMs: options.backoffMs,
  });

  const recordBillingSuccess = (
    workspaceId: string,
    plan: SubscriptionPlanName,
    interval: SubscriptionInterval,
    source: string,
    stripeInvoiceId?: string,
    stripePaymentIntentId?: string
  ) => {
    const planPrice = interval === "yearly" ? getBillingPlan(plan).yearlyPrice : getBillingPlan(plan).monthlyPrice;
    const subscription = db.getWorkspaceSubscription(workspaceId);
    const invoice = db.createBillingInvoice(workspaceId, {
      subscriptionId: subscription?.id,
      stripeInvoiceId,
      amountPaid: planPrice,
      currency: "USD",
      status: "paid",
      hostedInvoiceUrl: `https://billing.stripe.com/invoices/${stripeInvoiceId || `sandbox-${Date.now()}`}`,
      invoicePdfUrl: `https://billing.stripe.com/invoices/${stripeInvoiceId || `sandbox-${Date.now()}`}/pdf`,
    });
    db.createPaymentHistoryItem(workspaceId, {
      invoiceId: invoice.id,
      stripePaymentIntentId,
      amount: planPrice,
      currency: "USD",
      status: "paid",
      paymentMethod: source,
      description: `${plan} ${interval} subscription payment`,
    });
  };

  const activatePlan = (
    workspaceId: string,
    plan: SubscriptionPlanName,
    interval: SubscriptionInterval,
    options: {
      status?: SubscriptionStatus;
      stripeMode?: "sandbox" | "live";
      stripeCustomerId?: string;
      stripeSubscriptionId?: string;
      stripeCheckoutSessionId?: string;
      reason: string;
      recordPayment?: boolean;
      stripeInvoiceId?: string;
      stripePaymentIntentId?: string;
    }
  ) => {
    const status = options.status || (plan === "free" ? "trialing" : "active");
    const subscription = db.changeSubscriptionPlan(workspaceId, {
      plan,
      billingInterval: interval,
      status,
      stripeMode: options.stripeMode,
      stripeCustomerId: options.stripeCustomerId,
      stripeSubscriptionId: options.stripeSubscriptionId,
      stripeCheckoutSessionId: options.stripeCheckoutSessionId,
      reason: options.reason,
    });
    if (options.recordPayment && plan !== "free") {
      recordBillingSuccess(
        workspaceId,
        plan,
        interval,
        subscription.stripeMode === "live" ? "stripe" : "sandbox",
        options.stripeInvoiceId,
        options.stripePaymentIntentId
      );
    }
    return subscription;
  };

  // --- API Routes ---


  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // 1. Get workspace details
  app.get("/api/workspace", (req, res) => {
    const workspaceId = (req.query.workspaceId as string) || "default-workspace";
    const ws = db.getWorkspace(workspaceId);
    if (!ws) {
      res.status(404).json({ error: "Workspace not found" });
    } else {
      res.json(ws);
    }
  });

  app.get("/api/billing/overview", (req, res) => {
    const workspaceId = (req.query.workspaceId as string) || "default-workspace";
    try {
      return res.json(db.getBillingOverview(workspaceId));
    } catch (err: any) {
      return res.status(404).json({ error: err.message || "Billing overview not found." });
    }
  });

  app.get("/api/billing/analytics", (_req, res) => {
    return res.json(db.getBillingAnalytics());
  });

  app.get("/api/shopify/overview", (req, res) => {
    const workspaceId = (req.query.workspaceId as string) || "default-workspace";
    try {
      return res.json(db.getShopifySyncOverview(workspaceId));
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to load Shopify overview." });
    }
  });

  app.post("/api/shopify/oauth/start", (req, res) => {
    const { shopDomain } = req.body as { shopDomain?: string };
    if (!shopDomain) {
      return res.status(400).json({ error: "shopDomain is required." });
    }
    const result = startShopifyOAuth(shopDomain);
    return res.json(result);
  });

  app.post("/api/shopify/oauth/callback", async (req, res) => {
    const {
      workspaceId = "default-workspace",
      shopDomain,
      code,
      state,
    } = req.body as { workspaceId?: string; shopDomain?: string; code?: string; state?: string };
    if (!shopDomain) {
      return res.status(400).json({ error: "shopDomain is required." });
    }
    try {
      const store = await completeShopifyOAuth(db, {
        workspaceId,
        shopDomain,
        code,
        state,
      });
      const syncJobs = enqueueStoreSync(db, workspaceId, store.id);
      syncJobs.forEach((syncJob) => {
        enqueueQueueJob(workspaceId, "shopify_sync", syncJob.id, {
          workspaceId,
          storeId: store.id,
        }, {
          workerName: "shopify-worker",
          priority: 8,
          maxAttempts: 4,
          backoffMs: 2000,
        });
      });
      return res.status(201).json({ success: true, store, overview: db.getShopifySyncOverview(workspaceId) });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to complete Shopify OAuth." });
    }
  });

  app.post("/api/shopify/stores/:storeId/disconnect", async (req, res) => {
    const workspaceId = (req.body.workspaceId as string) || "default-workspace";
    const store = db.disconnectShopifyStore(workspaceId, req.params.storeId);
    if (!store) {
      return res.status(404).json({ error: "Store not found." });
    }
    return res.json({ success: true, store, overview: db.getShopifySyncOverview(workspaceId) });
  });

  app.post("/api/shopify/stores/:storeId/reconnect", (req, res) => {
    const workspaceId = (req.body.workspaceId as string) || "default-workspace";
    const store = db.updateShopifyStore(workspaceId, req.params.storeId, {
      status: "connected",
    });
    if (!store) {
      return res.status(404).json({ error: "Store not found." });
    }
    const refreshed = refreshShopifyAccessToken(db, workspaceId, req.params.storeId);
    const syncJobs = enqueueStoreSync(db, workspaceId, req.params.storeId);
    syncJobs.forEach((syncJob) => {
      enqueueQueueJob(workspaceId, "shopify_sync", syncJob.id, {
        workspaceId,
        storeId: req.params.storeId,
      }, {
        workerName: "shopify-worker",
        priority: 8,
        maxAttempts: 4,
        backoffMs: 2000,
      });
    });
    return res.json({ success: true, store: refreshed, overview: db.getShopifySyncOverview(workspaceId) });
  });

  app.post("/api/shopify/stores/:storeId/refresh-token", (req, res) => {
    const workspaceId = (req.body.workspaceId as string) || "default-workspace";
    try {
      const store = refreshShopifyAccessToken(db, workspaceId, req.params.storeId);
      return res.json({ success: true, store });
    } catch (err: any) {
      return res.status(404).json({ error: err.message || "Failed to refresh Shopify token." });
    }
  });

  app.post("/api/shopify/stores/:storeId/sync", (req, res) => {
    const workspaceId = (req.body.workspaceId as string) || "default-workspace";
    const scope = req.body.scope as ShopifySyncScope | undefined;
    const syncJobs = enqueueStoreSync(db, workspaceId, req.params.storeId, scope);
    syncJobs.forEach((syncJob) => {
      enqueueQueueJob(workspaceId, "shopify_sync", syncJob.id, {
        workspaceId,
        storeId: req.params.storeId,
      }, {
        workerName: "shopify-worker",
        priority: 8,
        maxAttempts: 4,
        backoffMs: 2000,
      });
    });
    return res.status(201).json({ success: true, jobs: syncJobs, overview: db.getShopifySyncOverview(workspaceId) });
  });

  app.post("/api/shopify/stores/:storeId/automation", (req, res) => {
    const workspaceId = (req.body.workspaceId as string) || "default-workspace";
    const settings = db.saveShopifyAutomationSettings(workspaceId, req.params.storeId, req.body);
    return res.json({ success: true, settings });
  });

  app.post("/api/shopify/webhooks/:storeId", (req, res) => {
    const workspaceId = (req.body.workspaceId as string) || "default-workspace";
    const topic = req.headers["x-shopify-topic"] || req.body.topic;
    if (!topic) {
      return res.status(400).json({ error: "Shopify webhook topic is required." });
    }
    try {
      const job = handleShopifyWebhook(
        db,
        workspaceId,
        req.params.storeId,
        topic as ShopifyWebhookTopic,
        (req.body.payload || req.body) as Record<string, unknown>
      );
      const queueJob = enqueueQueueJob(workspaceId, "shopify_sync", job.id, {
        workspaceId,
        storeId: req.params.storeId,
      }, {
        workerName: "shopify-worker",
        priority: 9,
        maxAttempts: 4,
        backoffMs: 1500,
      });
      return res.status(202).json({ success: true, job, queueJob, overview: db.getShopifySyncOverview(workspaceId) });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to handle Shopify webhook." });
    }
  });

  app.post("/api/billing/subscription/change", (req, res) => {
    const {
      workspaceId = "default-workspace",
      plan,
      billingInterval = "monthly",
    } = req.body as {
      workspaceId?: string;
      plan?: SubscriptionPlanName;
      billingInterval?: SubscriptionInterval;
    };

    if (!plan || !["free", "starter", "pro", "enterprise"].includes(plan)) {
      return res.status(400).json({ error: "A valid plan is required." });
    }

    const subscription = activatePlan(workspaceId, plan, billingInterval, {
      reason: `Changed subscription to ${plan} (${billingInterval}).`,
      stripeMode: getStripeMode(),
      recordPayment: plan !== "free",
    });
    return res.json({ success: true, subscription, overview: db.getBillingOverview(workspaceId) });
  });

  app.post("/api/billing/subscription/cancel", (req, res) => {
    const {
      workspaceId = "default-workspace",
      immediate = false,
    } = req.body as { workspaceId?: string; immediate?: boolean };
    try {
      const subscription = db.cancelWorkspaceSubscription(workspaceId, immediate);
      return res.json({ success: true, subscription });
    } catch (err: any) {
      return res.status(400).json({ error: err.message || "Failed to cancel subscription." });
    }
  });

  app.post("/api/billing/stripe/checkout-session", async (req, res) => {
    const {
      workspaceId = "default-workspace",
      plan,
      billingInterval = "monthly",
      successUrl = "http://localhost:3000/billing?session_id={CHECKOUT_SESSION_ID}",
      cancelUrl = "http://localhost:3000/billing",
      customerEmail,
    } = req.body as {
      workspaceId?: string;
      plan?: SubscriptionPlanName;
      billingInterval?: SubscriptionInterval;
      successUrl?: string;
      cancelUrl?: string;
      customerEmail?: string;
    };

    if (!plan || !["free", "starter", "pro", "enterprise"].includes(plan)) {
      return res.status(400).json({ error: "A valid plan is required." });
    }

    const workspace = db.getWorkspace(workspaceId);
    const subscription = db.getWorkspaceSubscription(workspaceId);
    if (!workspace || !subscription) {
      return res.status(404).json({ error: "Workspace not found." });
    }

    try {
      const session = await createCheckoutSession({
        workspaceId,
        workspaceName: workspace.name,
        plan,
        interval: billingInterval,
        successUrl,
        cancelUrl,
        customerEmail,
        stripeCustomerId: subscription.stripeCustomerId,
      });

      db.updateWorkspaceSubscription(workspaceId, {
        stripeCheckoutSessionId: session.sessionId,
        stripeMode: session.mode,
      });

      if (session.mode === "sandbox") {
        activatePlan(workspaceId, plan, billingInterval, {
          reason: `Sandbox checkout completed for ${plan} (${billingInterval}).`,
          stripeMode: "sandbox",
          stripeCheckoutSessionId: session.sessionId,
          recordPayment: plan !== "free",
        });
      }

      return res.json({
        success: true,
        sessionId: session.sessionId,
        stripeRedirectUrl: session.stripeRedirectUrl,
        mode: session.mode,
        overview: db.getBillingOverview(workspaceId),
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to create checkout session." });
    }
  });

  app.post("/api/billing/stripe/customer-portal", async (req, res) => {
    const {
      workspaceId = "default-workspace",
      returnUrl = "http://localhost:3000/billing",
    } = req.body as { workspaceId?: string; returnUrl?: string };

    try {
      const subscription = db.getWorkspaceSubscription(workspaceId);
      if (!subscription) {
        return res.status(404).json({ error: "Workspace subscription not found." });
      }
      const session = await createCustomerPortalSession({
        workspaceId,
        returnUrl,
        stripeCustomerId: subscription.stripeCustomerId,
      });
      db.updateWorkspaceSubscription(workspaceId, {
        stripePortalUrl: session.url,
        stripeMode: session.mode,
      });
      return res.json({ success: true, url: session.url, mode: session.mode });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to create customer portal session." });
    }
  });

  app.post("/api/billing/stripe/webhook", (req, res) => {
    const requestWithRaw = req as express.Request & { rawBody?: Buffer };
    const signature = req.headers["stripe-signature"] as string | undefined;
    let event: any = null;

    try {
      event = constructStripeWebhookEvent(requestWithRaw.rawBody || Buffer.from(JSON.stringify(req.body || {})), signature)
        || req.body;
    } catch (err: any) {
      return res.status(400).json({ error: err.message || "Invalid Stripe webhook signature." });
    }

    const eventType = event?.type;
    const eventObject = event?.data?.object || {};
    const metadata = eventObject.metadata || {};
    const workspaceId = metadata.workspaceId as string | undefined;

    if (!eventType) {
      return res.status(400).json({ error: "Webhook event type is required." });
    }

    db.recordStripeWebhookEvent(workspaceId, eventType, event);

    try {
      if (eventType === "checkout.session.completed" && workspaceId) {
        const plan = (metadata.plan || "starter") as SubscriptionPlanName;
        const interval = (metadata.interval || "monthly") as SubscriptionInterval;
        activatePlan(workspaceId, plan, interval, {
          reason: `Stripe checkout completed for ${plan} (${interval}).`,
          stripeMode: "live",
          stripeCustomerId: eventObject.customer || undefined,
          stripeSubscriptionId: eventObject.subscription || undefined,
          stripeCheckoutSessionId: eventObject.id || undefined,
          recordPayment: plan !== "free",
          stripePaymentIntentId: eventObject.payment_intent || undefined,
        });
      }

      if (eventType === "customer.subscription.updated" && workspaceId) {
        db.updateWorkspaceSubscription(workspaceId, {
          status: (eventObject.status || "active") as SubscriptionStatus,
          stripeSubscriptionId: eventObject.id || undefined,
          cancelAtPeriodEnd: Boolean(eventObject.cancel_at_period_end),
          currentPeriodStart: eventObject.current_period_start
            ? new Date(eventObject.current_period_start * 1000).toISOString()
            : undefined,
          currentPeriodEnd: eventObject.current_period_end
            ? new Date(eventObject.current_period_end * 1000).toISOString()
            : undefined,
        });
      }

      if (eventType === "customer.subscription.deleted" && workspaceId) {
        db.cancelWorkspaceSubscription(workspaceId, true);
      }

      if (eventType === "invoice.payment_succeeded" && workspaceId) {
        const subscription = db.getWorkspaceSubscription(workspaceId);
        if (subscription) {
          activatePlan(workspaceId, subscription.plan, subscription.billingInterval, {
            reason: `Renewed ${subscription.plan} subscription after successful invoice payment.`,
            stripeMode: "live",
            stripeCustomerId: subscription.stripeCustomerId,
            stripeSubscriptionId: subscription.stripeSubscriptionId,
            recordPayment: subscription.plan !== "free",
            stripeInvoiceId: eventObject.id || undefined,
            stripePaymentIntentId: eventObject.payment_intent || undefined,
          });
        }
      }

      if (eventType === "invoice.payment_failed" && workspaceId) {
        const subscription = db.getWorkspaceSubscription(workspaceId);
        if (subscription) {
          db.updateWorkspaceSubscription(workspaceId, {
            status: "past_due",
          });
        }
        db.createPaymentHistoryItem(workspaceId, {
          invoiceId: undefined,
          stripePaymentIntentId: eventObject.payment_intent || undefined,
          amount: (eventObject.amount_due || 0) / 100,
          currency: (eventObject.currency || "usd").toUpperCase(),
          status: "failed",
          paymentMethod: "stripe",
          description: "Invoice payment failed",
        });
      }

      return res.json({ received: true, action: eventType, workspaceId });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to process Stripe webhook." });
    }
  });

  // 2. Fetch normalized products (Tenant Isolated)
  app.get("/api/products", (req, res) => {
    const workspaceId = (req.query.workspaceId as string) || "default-workspace";
    const products = db.getProducts(workspaceId);
    res.json(products);
  });

  // 3. Fetch import operations (Tenant Isolated)
  app.get("/api/operations", (req, res) => {
    const workspaceId = (req.query.workspaceId as string) || "default-workspace";
    const ops = db.getImportOperations(workspaceId);
    res.json(ops);
  });

  // 4. Fetch audit logs (Tenant Isolated)
  app.get("/api/audit-logs", (req, res) => {
    const workspaceId = (req.query.workspaceId as string) || "default-workspace";
    const logs = db.getAuditLogs(workspaceId);
    res.json(logs);
  });

  // 4b. Delete product
  app.delete("/api/products/:productId", (req, res) => {
    const { productId } = req.params;
    const workspaceId = (req.query.workspaceId as string) || "default-workspace";
    const success = db.deleteProduct(workspaceId, productId);
    if (success) {
      res.json({ success: true, message: `Successfully deleted product ${productId}.` });
    } else {
      res.status(404).json({ error: "Failed to delete product or product not found." });
    }
  });

  // 5. Trigger multi-provider import with transaction-safe credit check
  app.post("/api/import", async (req, res) => {
    const { url, workspaceId = "default-workspace", customPrompt, rawHtml } = req.body;

    if (!url) {
      return res.status(400).json({ error: "Source URL is required." });
    }

    // 1. Credit Check: Guard against negative balances
    const hasSufficientCredits = db.checkCreditBalance(workspaceId, 20, "ai");
    if (!hasSufficientCredits) {
      db.logAudit(workspaceId, "IMPORT_BLOCKED", `Blocked import from ${url} due to low credits (< 20).`);
      return sendInsufficientCredits(res, workspaceId, "ai", 20);
    }

    // 2. Resolve Extractor via factory
    const extractor = ExtractorFactory.getExtractor(url);
    const providerName = extractor.providerName;

    // 3. Log Pending Transaction Operation
    const op = db.createImportOperation(workspaceId, providerName, url);

    const queueJob = enqueueQueueJob(workspaceId, "product_import", op.id, {
      workspaceId,
      url,
      customPrompt,
      rawHtml,
      operationId: op.id,
      extractor: providerName, // store extractor name in payload for logging
    }, {
      workerName: "import-worker",
      priority: 10,
      maxAttempts: 4,
      backoffMs: 2000,
    });

    return res.status(202).json({
      status: "queued",
      operation: op,
      queueJob,
      message: `Queued ${providerName} import for background processing.`,
    });
  });

  // 5b. Get import operation status
  app.get("/api/import/status/:operationId", (req, res) => {
    const workspaceId = (req.query.workspaceId as string) || "default-workspace";
    const operationId = req.params.operationId;
    const ops = db.getImportOperations(workspaceId);
    const op = ops.find((o) => o.id === operationId);
    if (!op) {
      return res.status(404).json({ error: "Operation not found." });
    }
    // Get product if exists
    let product = null;
    if (op.productId) {
      const products = db.getProducts(workspaceId);
      product = products.find((p) => p.id === op.productId) || null;
    }
    // Get attempt count from queue logs
    const logs = db.getQueueJobLogs(workspaceId);
    const jobLogs = logs.filter((log) => log.message.includes(operationId));
    const attemptCount = jobLogs.filter((log) => log.status === "processing" || log.status === "retrying" || log.status === "failed").length + 1;
    // Get extractor name from the operation (provider) or from queue job payload
    let extractor = op.provider || "Unknown";
    // try to get from queue job payload if not in operation
    if (!extractor || extractor === "Unknown") {
      const jobs = db.getQueueJobs(workspaceId, { includeCompleted: true });
      const job = jobs.find((j) => j.referenceId === operationId);
      if (job && job.payload && typeof job.payload === "object" && "extractor" in job.payload) {
        extractor = String(job.payload.extractor);
      }
    }

    return res.json({
      id: op.id,
      status: op.status,
      provider: op.provider,
      sourceUrl: op.sourceUrl,
      errorMessage: op.errorMessage || null,
      product,
      creditCharged: op.creditCharged,
      createdAt: op.createdAt,
      attemptCount,
      extractor,
    });
  });

  // --- Product Intelligence Endpoints (Phase 2) ---

  // 5a. Retrieve latest product analysis and version history
  app.get("/api/intelligence/analysis", (req, res) => {
    const productId = req.query.productId as string;
    if (!productId) {
      return res.status(400).json({ error: "productId parameter is required" });
    }
    const latest = db.getLatestProductAnalysis(productId);
    const history = db.getProductAnalyses(productId);
    return res.json({ latest, history });
  });

  // 5b. Trigger full product marketing & market intelligence analysis (costs exactly 20 credits)
  app.post("/api/intelligence/analyze", async (req, res) => {
    const { productId, languageCode = "en", workspaceId = "default-workspace" } = req.body;
    if (!productId) {
      return res.status(400).json({ error: "productId is required" });
    }

    try {
      if (!db.checkCreditBalance(workspaceId, 20, "ai")) {
        db.logAudit(workspaceId, "ANALYSIS_BLOCKED", `Blocked analysis for ${productId} due to low AI credits.`);
        return sendInsufficientCredits(res, workspaceId, "ai", 20);
      }
      // Find the specific product catalog item (multi-tenant boundary verified)
      const products = db.getProducts(workspaceId);
      const product = products.find((p) => p.id === productId);
      if (!product) {
        return res.status(404).json({ error: "Product not found or access denied." });
      }

      console.log(`[Intelligence API] Launching product analysis for item "${product.title}" [Lang: ${languageCode}]`);
      const analysis = await ProductAnalyzer.analyze(product, languageCode, workspaceId);
      return res.json({ success: true, analysis });
    } catch (err: any) {
      console.error(`[Intelligence API] Analysis process failed:`, err);
      return res.status(500).json({ error: err.message || "Failed to analyze product catalog details." });
    }
  });

  // 5c. Fetch complete credit tracking ledger audit rows
  app.get("/api/intelligence/ledger", (req, res) => {
    const workspaceId = (req.query.workspaceId as string) || "default-workspace";
    const entries = db.getCreditLedger(workspaceId);
    return res.json(entries);
  });

  // 5d. Fetch workspace analytics payload for the advanced analytics center
  app.get("/api/intelligence/analytics", (req, res) => {
    const workspaceId = (req.query.workspaceId as string) || "default-workspace";
    const selectedProductId = req.query.productId as string | undefined;
    const preset = (req.query.preset as "today" | "7d" | "30d" | "90d" | "custom") || "30d";
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    try {
      const payload = buildAdvancedAnalyticsPayload({
        workspaceId,
        selectedProductId,
        preset,
        startDate,
        endDate,
        products: db.getProducts(workspaceId),
        operations: db.getImportOperations(workspaceId),
        analyses: db.getWorkspaceProductAnalyses(workspaceId),
        contentGenerations: db.getWorkspaceContentGenerations(workspaceId),
        ledger: db.getCreditLedger(workspaceId),
      });
      return res.json(payload);
    } catch (err: any) {
      console.error("[Analytics API] Failed to build advanced analytics payload:", err);
      return res.status(500).json({
        error: err.message || "Failed to build advanced analytics payload.",
      });
    }
  });

  // --- Content Generation Engine Endpoints (Phase 3) ---

  // Generate marketing assets automatically
  app.post("/api/content/generate", async (req, res) => {
    const { productId, workspaceId = "default-workspace", contentType = "package", languageCode = "en" } = req.body;

    if (!productId) {
      return res.status(400).json({ error: "productId is required." });
    }

    if (!["hooks", "scripts", "package"].includes(contentType)) {
      return res.status(400).json({ error: "Invalid contentType. Allowed: hooks, scripts, package." });
    }

    // Determine credit cost
    const costMap: Record<string, number> = {
      hooks: 5,
      scripts: 10,
      package: 20
    };
    const creditsRequired = costMap[contentType] || 20;

    // 1. Check if workspace has enough credits
    const hasCredits = db.checkCreditBalance(workspaceId, creditsRequired, "ai");
    if (!hasCredits) {
      db.logAudit(workspaceId, "CONTENT_GEN_BLOCKED", `Blocked ${contentType} generation for product ${productId} due to low credits (< ${creditsRequired}).`);
      return sendInsufficientCredits(res, workspaceId, "ai", creditsRequired);
    }

    const products = db.getProducts(workspaceId);
    const product = products.find((p) => p.id === productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found or access denied." });
    }

    const queueJob = enqueueQueueJob(workspaceId, "ai_content_generation", productId, {
      workspaceId,
      productId,
      contentType,
      languageCode,
      creditsRequired,
    }, {
      workerName: "content-worker",
      priority: 7,
      maxAttempts: 3,
      backoffMs: 2500,
    });

    return res.status(202).json({
      success: true,
      queued: true,
      queueJob,
      message: `Queued ${contentType} generation for ${product.title}.`,
    });
  });

  // Fetch the latest generated marketing contents or packages for a specific product
  app.get("/api/content/:productId", (req, res) => {
    const { productId } = req.params;
    const contentType = req.query.contentType as string | undefined;

    if (!productId) {
      return res.status(400).json({ error: "productId parameter is required." });
    }

    const latest = db.getLatestContentGeneration(productId, contentType);
    return res.json({ latest });
  });

  // Fetch the historical list of all edits/generations for a product
  app.get("/api/content/history/:productId", (req, res) => {
    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({ error: "productId parameter is required." });
    }

    const history = db.getContentGenerations(productId);
    return res.json({ history });
  });

  // --- Social Publishing Center Endpoints (Phase 4) ---

  app.get("/api/publishing/accounts", (req, res) => {
    const workspaceId = (req.query.workspaceId as string) || "default-workspace";
    return res.json({
      accounts: db.getSocialAccounts(workspaceId),
      supportedPlatforms: supportedSocialPlatforms.map((platform) => ({
        platform,
        ...SocialPublisherService.getPlatformConfiguration(platform),
      })),
    });
  });

  app.post("/api/publishing/accounts", (req, res) => {
    const {
      workspaceId = "default-workspace",
      platform,
      username,
      platformUserId,
      avatarUrl,
      accessToken,
      refreshToken,
      tokenExpiresAt,
    } = req.body;

    if (!supportedSocialPlatforms.includes(platform)) {
      return res.status(400).json({ error: "Unsupported platform." });
    }

    if (!username || !platformUserId) {
      return res.status(400).json({ error: "username and platformUserId are required." });
    }

    const account = db.createSocialAccount(workspaceId, {
      platform,
      username,
      platformUserId,
      avatarUrl,
      accessToken,
      refreshToken,
      tokenExpiresAt,
      integrationMode: accessToken && process.env.SOCIAL_PUBLISH_LIVE === "true" ? "live" : "sandbox",
    });
    return res.status(201).json({ success: true, account });
  });

  app.delete("/api/publishing/accounts/:accountId", (req, res) => {
    const workspaceId = (req.query.workspaceId as string) || "default-workspace";
    const success = db.deleteSocialAccount(workspaceId, req.params.accountId);
    return success ? res.json({ success: true }) : res.status(404).json({ error: "Account not found." });
  });

  app.get("/api/publishing/content-sources", (req, res) => {
    const productId = req.query.productId as string;
    if (!productId) {
      return res.status(400).json({ error: "productId is required." });
    }

    const latest = db.getLatestContentGeneration(productId);
    const suggestions = latest ? buildSocialSuggestions(latest.payload as Record<string, any>, latest.id) : [];
    return res.json({ suggestions, latestGeneration: latest });
  });

  app.post("/api/publishing/posts", async (req, res) => {
    const {
      workspaceId = "default-workspace",
      productId,
      title,
      caption,
      hashtags = [],
      mediaUrls = [],
      platforms = [],
      action = "draft",
      scheduledAt,
      selectedSuggestionIds = [],
      contentSuggestions = [],
    } = req.body;

    if (!productId || !caption || !Array.isArray(platforms) || platforms.length === 0) {
      return res.status(400).json({ error: "productId, caption, and at least one platform are required." });
    }

    const validPlatforms = platforms.filter((platform: SocialPlatform) => supportedSocialPlatforms.includes(platform));
    if (validPlatforms.length === 0) {
      return res.status(400).json({ error: "No valid publishing platforms were selected." });
    }

    const latest = db.getLatestContentGeneration(productId);
    const suggestions = Array.isArray(contentSuggestions) && contentSuggestions.length > 0
      ? contentSuggestions
      : buildSocialSuggestions((latest?.payload || {}) as Record<string, any>, latest?.id);
    const selectedSuggestions = suggestions.filter((item: any) => selectedSuggestionIds.includes(item.id));
    const captionSources = selectedSuggestions.length > 0 ? selectedSuggestions : [{
      id: "manual",
      label: "Manual Caption",
      text: caption,
      type: "manual",
      generationId: latest?.id,
    }];

    const postsToSave = validPlatforms.flatMap((platform: SocialPlatform) =>
      captionSources.map((source: any) => ({
        platform,
        title: title || `${platform} post for ${productId}`,
        caption: source.text || caption,
        hashtags,
        mediaUrls,
        status: (action === "schedule" ? "scheduled" : "draft") as SocialPostStatus,
        scheduledAt: action === "schedule" ? scheduledAt : undefined,
        previewText: `${(source.text || caption).slice(0, 180)}${(source.text || caption).length > 180 ? "..." : ""}`,
        sourceType: source.type,
        sourceGenerationId: source.generationId,
      }))
    );

    const publishingCreditsRequired = action === "draft" ? 0 : postsToSave.length;
    if (publishingCreditsRequired > 0 && !db.checkCreditBalance(workspaceId, publishingCreditsRequired, "publishing")) {
      db.logAudit(workspaceId, "PUBLISHING_BLOCKED", `Blocked ${action} for ${productId} due to low publishing credits.`);
      return sendInsufficientCredits(res, workspaceId, "publishing", publishingCreditsRequired);
    }

    const savedPosts = db.saveSocialPosts(workspaceId, productId, postsToSave);

    if (publishingCreditsRequired > 0) {
      db.consumeCredits(
        workspaceId,
        "publishing",
        publishingCreditsRequired,
        "publishing_consume",
        productId,
        `Reserved ${publishingCreditsRequired} publishing credits for ${action} action on product ${productId}`
      );
    }

    if (action === "publish") {
      const queueJobs = savedPosts.map((post) =>
        enqueueQueueJob(workspaceId, "social_publishing", post.id, {
          workspaceId,
          postId: post.id,
        }, {
          workerName: "publishing-worker",
          priority: 8,
          maxAttempts: 4,
          backoffMs: 2000,
        })
      );
      return res.status(202).json({ success: true, posts: savedPosts, queueJobs });
    }

    return res.status(201).json({ success: true, posts: savedPosts });
  });

  app.post("/api/publishing/posts/:postId/publish", async (req, res) => {
    const workspaceId = (req.body.workspaceId as string) || "default-workspace";
    try {
      if (!db.checkCreditBalance(workspaceId, 1, "publishing")) {
        return sendInsufficientCredits(res, workspaceId, "publishing", 1);
      }
      db.consumeCredits(
        workspaceId,
        "publishing",
        1,
        "publishing_consume",
        req.params.postId,
        `Published social post ${req.params.postId}`
      );
      const queueJob = enqueueQueueJob(workspaceId, "social_publishing", req.params.postId, {
        workspaceId,
        postId: req.params.postId,
      }, {
        workerName: "publishing-worker",
        priority: 8,
        maxAttempts: 4,
        backoffMs: 2000,
      });
      return res.status(202).json({ success: true, queueJob, post: db.getSocialPostById(workspaceId, req.params.postId) });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to publish post." });
    }
  });

  app.get("/api/publishing/posts/calendar", (req, res) => {
    const workspaceId = (req.query.workspaceId as string) || "default-workspace";
    const productId = req.query.productId as string | undefined;
    return res.json({
      posts: db.getSocialPosts(workspaceId, { productId, includeAll: true }),
    });
  });

  app.get("/api/publishing/posts/history", (req, res) => {
    const workspaceId = (req.query.workspaceId as string) || "default-workspace";
    const productId = req.query.productId as string | undefined;
    return res.json({
      posts: db.getSocialPosts(workspaceId, { productId, includeAll: true }),
    });
  });

  app.get("/api/publishing/posts/queue", (req, res) => {
    const workspaceId = (req.query.workspaceId as string) || "default-workspace";
    const productId = req.query.productId as string | undefined;
    const posts = db.getSocialPosts(workspaceId, { productId, includeAll: true }).filter((post) =>
      post.status === "scheduled" || post.status === "publishing" || post.status === "failed"
    );
    return res.json({ posts });
  });

  app.get("/api/publishing/analytics", (req, res) => {
    const workspaceId = (req.query.workspaceId as string) || "default-workspace";
    const productId = req.query.productId as string | undefined;
    const posts = db.getSocialPosts(workspaceId, { productId, includeAll: true });
    const published = posts.filter((post) => post.status === "published");
    const scheduled = posts.filter((post) => post.status === "scheduled");
    const drafts = posts.filter((post) => post.status === "draft");
    const failed = posts.filter((post) => post.status === "failed");
    const byPlatform = supportedSocialPlatforms.map((platform) => {
      const subset = published.filter((post) => post.platform === platform);
      return {
        platform,
        posts: subset.length,
        engagement: subset.reduce((sum, post) => sum + post.metrics.engagement, 0),
        reach: subset.reduce((sum, post) => sum + post.metrics.reach, 0),
        clicks: subset.reduce((sum, post) => sum + post.metrics.clicks, 0),
      };
    });

    return res.json({
      publishedPosts: published.length,
      scheduledPosts: scheduled.length,
      draftPosts: drafts.length,
      failedPosts: failed.length,
      engagement: published.reduce((sum, post) => sum + post.metrics.engagement, 0),
      reach: published.reduce((sum, post) => sum + post.metrics.reach, 0),
      clicks: published.reduce((sum, post) => sum + post.metrics.clicks, 0),
      platformPerformance: byPlatform,
    });
  });

  // --- AI Video Studio Endpoints (Phase 5) ---

  app.get("/api/video/providers", (req, res) => {
    return res.json({
      providers: getVideoProviders().map((provider) => ({
        name: provider.name,
        label: provider.label,
        mode: provider.mode,
      })),
      fallbackChain: getDefaultFallbackChain(),
      templates: supportedVideoTemplates,
    });
  });

  app.post("/api/video/generate", async (req, res) => {
    const {
      workspaceId = "default-workspace",
      productId,
      template = "product_showcase",
      outputType = "short_form_vertical",
      inputMode = "product_data",
      prompt = "",
      durationSeconds = 30,
      aspectRatio = "9:16",
      provider,
      sourceImageUrls = [],
    } = req.body as {
      workspaceId?: string;
      productId?: string;
      template?: VideoTemplateName;
      outputType?: VideoOutputType;
      inputMode?: VideoInputMode;
      prompt?: string;
      durationSeconds?: number;
      aspectRatio?: VideoAspectRatio;
      provider?: VideoProviderName;
      sourceImageUrls?: string[];
    };

    if (!productId) {
      return res.status(400).json({ error: "productId is required." });
    }

    const products = db.getProducts(workspaceId);
    const product = products.find((item) => item.id === productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found or access denied." });
    }

    const estimatedCredits = (outputType === "long_form_promotional" ? 20 : 10) + Math.max(0, Math.round(durationSeconds / 15));
    if (!db.checkCreditBalance(workspaceId, estimatedCredits, "video")) {
      return sendInsufficientCredits(res, workspaceId, "video", estimatedCredits);
    }

    try {
      const analysis = db.getLatestProductAnalysis(productId);
      const latestContent = db.getLatestContentGeneration(productId);
      const draft = await createVideoDraft(db, {
        workspaceId,
        product,
        analysis,
        latestContent,
        template,
        outputType,
        inputMode,
        prompt: prompt || `Create a ${template} video for ${product.title}.`,
        durationSeconds,
        aspectRatio,
        provider,
        sourceImageUrls: sourceImageUrls.length > 0 ? sourceImageUrls : [product.images, ...product.gallery].filter(Boolean),
      });
      const queueJob = enqueueQueueJob(workspaceId, "ai_video_rendering", draft.id, {
        workspaceId,
        generationId: draft.id,
      }, {
        workerName: "video-worker",
        priority: outputType === "long_form_promotional" ? 9 : 8,
        maxAttempts: 4,
        backoffMs: 3000,
      });
      return res.status(202).json({ success: true, generation: db.getVideoGenerationById(workspaceId, draft.id), queueJob });
    } catch (err: any) {
      console.error("[Video Studio] Failed to create AI video render:", err);
      return res.status(500).json({ error: err.message || "Failed to generate AI video." });
    }
  });

  app.get("/api/video/:productId", (req, res) => {
    const productId = req.params.productId;
    return res.json({ latest: db.getLatestVideoGeneration(productId) });
  });

  app.get("/api/video/history/:productId", (req, res) => {
    const productId = req.params.productId;
    return res.json({ history: db.getVideoGenerations(productId) });
  });

  app.get("/api/video/queue/:productId", (req, res) => {
    const productId = req.params.productId;
    const items = db.getVideoGenerations(productId).filter((item) =>
      item.status === "queued" || item.status === "rendering" || item.status === "failed"
    );
    return res.json({ queue: items });
  });

  app.get("/api/video/analytics/:productId", (req, res) => {
    const productId = req.params.productId;
    const items = db.getVideoGenerations(productId);
    return res.json(buildVideoAnalytics(items));
  });

  app.delete("/api/video/:videoId", (req, res) => {
    const workspaceId = (req.query.workspaceId as string) || "default-workspace";
    const success = db.deleteVideoGeneration(workspaceId, req.params.videoId);
    return success ? res.json({ success: true }) : res.status(404).json({ error: "AI video generation not found." });
  });

  app.get("/api/queue/overview", (req, res) => {
    const workspaceId = req.query.workspaceId as string | undefined;
    return res.json(queueEngine.getOverview(workspaceId));
  });

  app.get("/api/queue/jobs", (req, res) => {
    const workspaceId = req.query.workspaceId as string | undefined;
    const status = req.query.status as string | undefined;
    const kind = req.query.kind as QueueJobKind | undefined;
    return res.json({
      jobs: db.getQueueJobs(workspaceId, {
        statuses: status ? [status as any] : undefined,
        kinds: kind ? [kind] : undefined,
        includeCompleted: true,
      }),
      logs: db.getQueueJobLogs(workspaceId),
    });
  });

  app.post("/api/queue/jobs/:jobId/retry", (req, res) => {
    const retried = db.retryQueueJob(req.params.jobId);
    return retried
      ? res.json({ success: true, job: retried })
      : res.status(404).json({ error: "Queue job not found." });
  });

  app.post("/api/queue/jobs/:jobId/cancel", (req, res) => {
    const cancelled = db.cancelQueueJob(req.params.jobId);
    return cancelled
      ? res.json({ success: true, job: cancelled })
      : res.status(404).json({ error: "Queue job not found." });
  });

  app.post("/api/queue/cleanup", (_req, res) => {
    db.cleanupQueueRecords(24, 72, 72);
    return res.json({ success: true });
  });

  // 6. Refill / Update workspace credits (Helper for testing and manual adjustments)
  app.post("/api/set-credits", (req, res) => {
    const { workspaceId = "default-workspace", amount } = req.body;
    if (typeof amount !== "number" || amount < 0) {
      res.status(400).json({ error: "Amount must be a non-negative number." });
    } else {
      db.setCredits(workspaceId, amount);
      res.json({ message: `Successfully updated credits to ${amount}`, credits: amount });
    }
  });

  // Integrate Vite for local dev vs handle static serving in build-production mode
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Bind to 0.0.0.0 which handles container ingress successfully
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[AuraPost Server] Active and routing at http://0.0.0.0:${PORT}`);
  });
}

startServer();
