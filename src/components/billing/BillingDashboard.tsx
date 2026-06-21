import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, CreditCard, Receipt, Wallet } from "lucide-react";
import {
  BillingOverview,
  SubscriptionInterval,
  SubscriptionPlanName,
  Workspace,
} from "../../types.ts";
import PricingPage from "./PricingPage.tsx";
import SubscriptionCard from "./SubscriptionCard.tsx";
import UsageMeter from "./UsageMeter.tsx";
import InvoiceHistory from "./InvoiceHistory.tsx";
import PaymentHistory from "./PaymentHistory.tsx";

interface BillingDashboardProps {
  workspaceId: string;
  workspace: Workspace | null;
  onWorkspaceRefresh: () => Promise<void> | void;
}

export default function BillingDashboard({
  workspaceId,
  workspace,
  onWorkspaceRefresh,
}: BillingDashboardProps) {
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [billingInterval, setBillingInterval] = useState<SubscriptionInterval>("monthly");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchOverview = async () => {
    const res = await fetch(`/api/billing/overview?workspaceId=${workspaceId}`);
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || "Failed to load billing overview.");
      return;
    }
    setOverview(payload);
    setBillingInterval(payload.subscription.billingInterval);
  };

  useEffect(() => {
    fetchOverview();
  }, [workspaceId]);

  const refreshAll = async () => {
    await fetchOverview();
    await onWorkspaceRefresh();
  };

  const handlePlanChange = async (plan: SubscriptionPlanName) => {
    setError(null);
    setFeedback(null);
    const res = await fetch("/api/billing/stripe/checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        plan,
        billingInterval,
        successUrl: `${window.location.origin}/billing?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/billing`,
      }),
    });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || "Failed to start checkout.");
      return;
    }
    setFeedback(
      payload.mode === "live"
        ? `Stripe checkout session created for ${plan}.`
        : `Sandbox billing updated to ${plan}.`
    );
    if (payload.mode === "live" && payload.stripeRedirectUrl) {
      window.open(payload.stripeRedirectUrl, "_blank", "noopener,noreferrer");
    }
    await refreshAll();
  };

  const handleCancel = async (immediate = false) => {
    const res = await fetch("/api/billing/subscription/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, immediate }),
    });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || "Failed to cancel subscription.");
      return;
    }
    setFeedback("Subscription updated.");
    await refreshAll();
  };

  const handlePortal = async () => {
    const res = await fetch("/api/billing/stripe/customer-portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, returnUrl: `${window.location.origin}/billing` }),
    });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || "Failed to open billing portal.");
      return;
    }
    setFeedback(`Opened ${payload.mode} customer portal.`);
    if (payload.url) {
      window.open(payload.url, "_blank", "noopener,noreferrer");
    }
    await refreshAll();
  };

  const revenueByPlan = useMemo(() => overview?.analytics.revenueByPlan || [], [overview]);

  if (!overview) {
    return (
      <div className="bg-slate-950 border border-slate-900 rounded-xl p-6 text-white">
        Loading billing workspace...
      </div>
    );
  }

  return (
    <div className="bg-slate-950 border border-slate-900 rounded-xl p-6 text-white flex flex-col gap-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-900 pb-5">
        <div>
          <span className="text-xs font-mono text-indigo-400 uppercase tracking-widest">Billing & Subscription System</span>
          <h3 className="text-xl font-bold mt-1">{overview.workspace.name}</h3>
          <p className="text-xs text-slate-400 mt-2">
            Manage pricing, Stripe lifecycle flows, credit pools, invoices, payments, and recurring revenue analytics.
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-400">
          Plan <span className="text-indigo-300 font-semibold uppercase">{overview.subscription.plan}</span> · Total credits <span className="text-white font-semibold">{workspace?.credits ?? overview.workspace.credits}</span>
        </div>
      </div>

      {error && (
        <div className="bg-rose-950/40 border border-rose-500/30 rounded-lg p-3 text-xs text-rose-300">{error}</div>
      )}
      {feedback && (
        <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-lg p-3 text-xs text-emerald-300">{feedback}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-indigo-300" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">MRR</span>
          </div>
          <p className="text-3xl font-bold text-white mt-3">${overview.analytics.mrr.toFixed(2)}</p>
        </div>
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-300" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">ARR</span>
          </div>
          <p className="text-3xl font-bold text-white mt-3">${overview.analytics.arr.toFixed(2)}</p>
        </div>
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-amber-300" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Churn</span>
          </div>
          <p className="text-3xl font-bold text-white mt-3">{overview.analytics.churnRate}%</p>
        </div>
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-rose-300" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Active Subs</span>
          </div>
          <p className="text-3xl font-bold text-white mt-3">{overview.analytics.activeSubscriptions}</p>
        </div>
      </div>

      <SubscriptionCard
        subscription={overview.subscription}
        onCancel={handleCancel}
        onOpenPortal={handlePortal}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <UsageMeter bucket={overview.workspace.creditPools!.ai} onUpgrade={() => handlePlanChange("starter")} />
        <UsageMeter bucket={overview.workspace.creditPools!.video} onUpgrade={() => handlePlanChange("pro")} />
        <UsageMeter bucket={overview.workspace.creditPools!.publishing} onUpgrade={() => handlePlanChange("starter")} />
      </div>

      <PricingPage
        plans={overview.plans}
        currentPlan={overview.subscription.plan}
        interval={billingInterval}
        onIntervalChange={setBillingInterval}
        onSelectPlan={handlePlanChange}
      />

      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Revenue By Plan</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mt-4">
          {revenueByPlan.map((row) => (
            <div key={row.plan} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs">
              <p className="text-white font-semibold uppercase">{row.plan}</p>
              <p className="text-slate-400 mt-2">${row.revenue.toFixed(2)} MRR</p>
              <p className="text-slate-500 mt-1">{row.workspaces} workspace(s)</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <InvoiceHistory invoices={overview.invoices} />
        <PaymentHistory payments={overview.payments} />
      </div>
    </div>
  );
}
