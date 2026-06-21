import React, { useEffect, useState } from "react";
import { RefreshCcw, ServerCog, ShieldCheck, SlidersHorizontal, Store } from "lucide-react";
import {
  BillingOverview,
  QueueOverview,
  ShopifySyncOverview,
  Workspace,
  WorkspaceCreditBucket,
} from "../types.ts";

interface SettingsCenterProps {
  workspaceId: string;
  workspace: Workspace | null;
  onWorkspaceRefresh: () => Promise<void> | void;
}

export default function SettingsCenter({
  workspaceId,
  workspace,
  onWorkspaceRefresh,
}: SettingsCenterProps) {
  const [billingOverview, setBillingOverview] = useState<BillingOverview | null>(null);
  const [shopifyOverview, setShopifyOverview] = useState<ShopifySyncOverview | null>(null);
  const [queueOverview, setQueueOverview] = useState<QueueOverview | null>(null);
  const [health, setHealth] = useState<{ status: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setLoading(true);
      setError(null);
      const [healthRes, billingRes, shopifyRes, queueRes] = await Promise.all([
        fetch("/api/health"),
        fetch(`/api/billing/overview?workspaceId=${workspaceId}`),
        fetch(`/api/shopify/overview?workspaceId=${workspaceId}`),
        fetch(`/api/queue/overview?workspaceId=${workspaceId}`),
      ]);

      if (healthRes.ok) {
        setHealth(await healthRes.json());
      }

      if (billingRes.ok) {
        setBillingOverview(await billingRes.json());
      }

      if (shopifyRes.ok) {
        setShopifyOverview(await shopifyRes.json());
      }

      if (queueRes.ok) {
        setQueueOverview(await queueRes.json());
      }

      await onWorkspaceRefresh();
    } catch (err) {
      console.error("Failed to load settings center:", err);
      setError("Failed to load workspace settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [workspaceId]);

  const creditBuckets: WorkspaceCreditBucket[] = workspace?.creditPools
    ? [workspace.creditPools.ai, workspace.creditPools.video, workspace.creditPools.publishing]
    : [];

  return (
    <div className="bg-slate-950 border border-slate-900 rounded-xl p-6 text-white flex flex-col gap-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-900 pb-5">
        <div>
          <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest">Settings</span>
          <h3 className="text-xl font-bold mt-1">Workspace configuration center</h3>
          <p className="text-xs text-slate-400 mt-2 max-w-3xl">
            Review runtime health, subscription state, queue capacity, connected Shopify stores, and the active credit pool configuration for this workspace.
          </p>
        </div>
        <button
          onClick={refresh}
          className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 text-sm font-semibold flex items-center gap-2"
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh settings
        </button>
      </div>

      {error && (
        <div className="bg-rose-950/40 border border-rose-500/30 rounded-lg p-3 text-xs text-rose-300">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">API Health</span>
          </div>
          <p className="text-2xl font-bold text-white mt-3">{health?.status || "unknown"}</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <ServerCog className="w-4 h-4 text-indigo-300" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Subscription</span>
          </div>
          <p className="text-2xl font-bold text-white mt-3">{billingOverview?.subscription.plan || workspace?.plan || "free"}</p>
          <p className="text-xs text-slate-400 mt-2">{billingOverview?.subscription.status || workspace?.subscriptionStatus || "trialing"}</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-emerald-300" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Shopify Stores</span>
          </div>
          <p className="text-2xl font-bold text-white mt-3">{shopifyOverview?.analytics.connectedStores || 0}</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-amber-300" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Queue Jobs</span>
          </div>
          <p className="text-2xl font-bold text-white mt-3">{queueOverview?.jobs.length || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
          <h4 className="text-sm font-semibold mb-4">Workspace profile</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3">
              <p className="text-[11px] font-mono uppercase tracking-widest text-slate-500">Workspace</p>
              <p className="text-slate-100 mt-2">{workspace?.name || workspaceId}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3">
              <p className="text-[11px] font-mono uppercase tracking-widest text-slate-500">Stripe mode</p>
              <p className="text-slate-100 mt-2">{billingOverview?.subscription.stripeMode || workspace?.stripeMode || "sandbox"}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3">
              <p className="text-[11px] font-mono uppercase tracking-widest text-slate-500">Current period</p>
              <p className="text-slate-100 mt-2">
                {billingOverview?.subscription.currentPeriodStart ? new Date(billingOverview.subscription.currentPeriodStart).toLocaleDateString() : "n/a"}{" "}
                to{" "}
                {billingOverview?.subscription.currentPeriodEnd ? new Date(billingOverview.subscription.currentPeriodEnd).toLocaleDateString() : "n/a"}
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3">
              <p className="text-[11px] font-mono uppercase tracking-widest text-slate-500">Queue workers</p>
              <p className="text-slate-100 mt-2">{queueOverview?.workers.length || 0} tracked workers</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
          <h4 className="text-sm font-semibold mb-4">Integration posture</h4>
          <div className="flex flex-col gap-3 text-sm">
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 flex items-center justify-between">
              <span className="text-slate-300">Billing invoices</span>
              <span className="text-slate-100">{billingOverview?.invoices.length || 0}</span>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 flex items-center justify-between">
              <span className="text-slate-300">Connected stores</span>
              <span className="text-slate-100">{shopifyOverview?.stores.length || 0}</span>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 flex items-center justify-between">
              <span className="text-slate-300">Failed sync jobs</span>
              <span className="text-slate-100">{shopifyOverview?.analytics.syncFailures || 0}</span>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 flex items-center justify-between">
              <span className="text-slate-300">Dead-letter jobs</span>
              <span className="text-slate-100">{queueOverview?.deadLetterJobs.length || 0}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
        <h4 className="text-sm font-semibold mb-4">Credit pools</h4>
        {creditBuckets.length === 0 ? (
          <p className="text-sm text-slate-400">Credit pools are unavailable for this workspace.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {creditBuckets.map((bucket) => (
              <div key={bucket.bucket} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-[11px] font-mono uppercase tracking-widest text-slate-500">{bucket.label}</p>
                <p className="text-2xl font-bold text-white mt-3">{bucket.balance}</p>
                <p className="text-xs text-slate-400 mt-2">Used this period {bucket.usedThisPeriod} / {bucket.monthlyAllocation}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
