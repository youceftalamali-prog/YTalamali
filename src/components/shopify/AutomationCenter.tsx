import React from "react";
import { ShopifyAutomationRun, ShopifyAutomationSettings, ShopifyStoreConnection } from "../../types.ts";

interface AutomationCenterProps {
  store?: ShopifyStoreConnection;
  settings?: ShopifyAutomationSettings;
  runs: ShopifyAutomationRun[];
  workspaceId: string;
  onRefresh: () => Promise<void>;
}

export default function AutomationCenter({
  store,
  settings,
  runs,
  workspaceId,
  onRefresh,
}: AutomationCenterProps) {
  const updateSetting = async (
    field: keyof Omit<ShopifyAutomationSettings, "id" | "workspaceId" | "storeId" | "updatedAt">
  ) => {
    if (!store || !settings) {
      return;
    }
    await fetch(`/api/shopify/stores/${store.id}/automation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        [field]: !settings[field],
      }),
    });
    await onRefresh();
  };

  const toggles: Array<{
    field: keyof Omit<ShopifyAutomationSettings, "id" | "workspaceId" | "storeId" | "updatedAt">;
    label: string;
    description: string;
  }> = [
    { field: "autoSyncEveryHour", label: "Auto sync every hour", description: "Queue products, collections, inventory, orders, and customers every hour." },
    { field: "autoPublishGeneratedContent", label: "Auto publish generated content", description: "Promote generated content packages when synced products update." },
    { field: "autoCreateSocialPosts", label: "Auto create social posts", description: "Create draft social posts for synced products automatically." },
    { field: "autoGenerateVideos", label: "Auto generate videos", description: "Queue short-form product videos after product sync completes." },
    { field: "autoCompetitorMonitoring", label: "Auto competitor monitoring", description: "Trigger competitor monitoring refreshes for newly synced products." },
  ];

  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">AutomationCenter</h3>
        <p className="text-xs text-slate-400 mt-1">Control hourly sync schedules and downstream AI automation triggered by Shopify changes.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {toggles.map((toggle) => {
          const enabled = settings ? Boolean(settings[toggle.field]) : false;
          return (
            <button
              key={toggle.field}
              onClick={() => updateSetting(toggle.field)}
              disabled={!store}
              className={`text-left rounded-xl border p-4 transition ${
                enabled
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : "bg-slate-900 border-slate-800 hover:border-slate-700"
              } disabled:opacity-50`}
            >
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-white font-semibold text-sm">{toggle.label}</h4>
                <span className="px-2 py-1 rounded-full bg-slate-950 border border-slate-800 text-slate-300 text-[10px] font-mono uppercase">
                  {enabled ? "On" : "Off"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2">{toggle.description}</p>
            </button>
          );
        })}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <h4 className="text-white font-semibold">Recent Automation Runs</h4>
        <div className="flex flex-col gap-3 mt-4 max-h-[260px] overflow-y-auto">
          {runs.map((run) => (
            <div key={run.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-white font-semibold uppercase">{run.action.replace(/_/g, " ")}</span>
                <span className="px-2 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-[10px] font-mono uppercase">
                  {run.status}
                </span>
              </div>
              <p className="text-slate-400 mt-2">{run.detail}</p>
              <p className="text-slate-500 mt-2">{new Date(run.createdAt).toLocaleString()}</p>
            </div>
          ))}
          {runs.length === 0 && (
            <div className="border border-dashed border-slate-800 rounded-xl p-4 text-xs text-slate-500">
              No automation runs recorded yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
