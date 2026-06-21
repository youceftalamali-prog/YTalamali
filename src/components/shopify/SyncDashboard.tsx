import React from "react";
import { Activity, Boxes, ShoppingBag, TriangleAlert, Zap } from "lucide-react";
import { ShopifySyncAnalytics } from "../../types.ts";

interface SyncDashboardProps {
  analytics: ShopifySyncAnalytics;
}

const cards = [
  { key: "connectedStores", label: "Connected Stores", icon: Activity, accent: "text-emerald-300" },
  { key: "syncedProducts", label: "Synced Products", icon: Boxes, accent: "text-indigo-300" },
  { key: "ordersImported", label: "Orders Imported", icon: ShoppingBag, accent: "text-amber-300" },
  { key: "syncFailures", label: "Sync Failures", icon: TriangleAlert, accent: "text-rose-300" },
  { key: "automationExecutions", label: "Automation Executions", icon: Zap, accent: "text-cyan-300" },
] as const;

export default function SyncDashboard({ analytics }: SyncDashboardProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">SyncDashboard</h3>
        <p className="text-xs text-slate-400 mt-1">Monitor product sync throughput, imported order volume, revenue, and automation activity.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          const value = analytics[card.key];
          return (
            <div key={card.key} className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${card.accent}`} />
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">{card.label}</span>
              </div>
              <p className="text-3xl font-bold text-white mt-3">
                {value}
              </p>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Revenue Imported</span>
        <p className="text-3xl font-bold text-white mt-3">${analytics.revenueImported.toFixed(2)}</p>
      </div>
    </div>
  );
}
