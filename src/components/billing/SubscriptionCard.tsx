import React from "react";
import { WorkspaceSubscription } from "../../types.ts";

interface SubscriptionCardProps {
  subscription: WorkspaceSubscription;
  onCancel: (immediate?: boolean) => Promise<void>;
  onOpenPortal: () => Promise<void>;
}

export default function SubscriptionCard({
  subscription,
  onCancel,
  onOpenPortal,
}: SubscriptionCardProps) {
  const trialLabel = subscription.trialEndsAt
    ? `Trial ends ${new Date(subscription.trialEndsAt).toLocaleDateString()}`
    : `Billing period ends ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`;

  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">SubscriptionCard</h3>
          <p className="text-xs text-slate-400 mt-1">Manage your plan, trial state, renewal window, and billing portal access.</p>
        </div>
        <span className="px-2 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-mono uppercase">
          {subscription.plan} / {subscription.status}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
          <span className="text-slate-500 uppercase font-mono text-[10px]">Interval</span>
          <p className="text-white mt-1">{subscription.billingInterval}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
          <span className="text-slate-500 uppercase font-mono text-[10px]">Renewal</span>
          <p className="text-white mt-1">{trialLabel}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
          <span className="text-slate-500 uppercase font-mono text-[10px]">Stripe Mode</span>
          <p className="text-white mt-1">{subscription.stripeMode}</p>
        </div>
      </div>

      {subscription.cancelAtPeriodEnd && (
        <div className="bg-amber-950/30 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-200">
          Cancellation is scheduled for the end of the current billing period.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onOpenPortal()}
          className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 text-xs font-semibold"
        >
          Open Customer Portal
        </button>
        <button
          onClick={() => onCancel(false)}
          className="px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-200 text-xs font-semibold"
        >
          Cancel At Period End
        </button>
      </div>
    </div>
  );
}
