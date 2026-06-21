import React from "react";
import { BillingPlanDefinition, SubscriptionInterval, SubscriptionPlanName } from "../../types.ts";

interface PricingPageProps {
  plans: BillingPlanDefinition[];
  currentPlan: SubscriptionPlanName;
  interval: SubscriptionInterval;
  onIntervalChange: (interval: SubscriptionInterval) => void;
  onSelectPlan: (plan: SubscriptionPlanName) => Promise<void>;
}

export default function PricingPage({
  plans,
  currentPlan,
  interval,
  onIntervalChange,
  onSelectPlan,
}: PricingPageProps) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 flex flex-col gap-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">PricingPage</h3>
          <p className="text-xs text-slate-400 mt-1">Choose the plan that matches your AI, video, and publishing throughput.</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg p-1">
          <button
            onClick={() => onIntervalChange("monthly")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold ${interval === "monthly" ? "bg-indigo-600 text-white" : "text-slate-400"}`}
          >
            Monthly
          </button>
          <button
            onClick={() => onIntervalChange("yearly")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold ${interval === "yearly" ? "bg-indigo-600 text-white" : "text-slate-400"}`}
          >
            Yearly
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const price = interval === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
          return (
            <div
              key={plan.id}
              className={`rounded-xl border p-4 flex flex-col gap-4 ${
                isCurrent
                  ? "bg-indigo-500/10 border-indigo-500/30"
                  : "bg-slate-900 border-slate-800"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-base font-bold text-white">{plan.label}</h4>
                  {isCurrent && (
                    <span className="px-2 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-mono uppercase">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-2">{plan.description}</p>
              </div>

              <div>
                <p className="text-3xl font-bold text-white">${price}</p>
                <p className="text-xs text-slate-500 mt-1">per {interval === "yearly" ? "year" : "month"}</p>
              </div>

              <div className="grid grid-cols-1 gap-2 text-xs text-slate-300">
                <div>AI credits: {plan.aiCredits}</div>
                <div>Video credits: {plan.videoCredits}</div>
                <div>Publishing credits: {plan.publishingCredits}</div>
                <div>Trial: {plan.trialDays} days</div>
              </div>

              <div className="flex flex-col gap-2 text-xs text-slate-400">
                {plan.features.map((feature) => (
                  <div key={feature}>{feature}</div>
                ))}
              </div>

              <button
                onClick={() => onSelectPlan(plan.id)}
                className={`mt-auto px-3 py-2 rounded-lg text-sm font-semibold ${
                  isCurrent
                    ? "bg-slate-950 border border-slate-800 text-slate-300"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white"
                }`}
              >
                {isCurrent ? "Current Plan" : `Choose ${plan.label}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
