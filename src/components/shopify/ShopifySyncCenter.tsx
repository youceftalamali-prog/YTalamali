import React, { useEffect, useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";
import {
  ShopifyAutomationSettings,
  ShopifyStoreConnection,
  ShopifySyncOverview,
  Workspace,
} from "../../types.ts";
import ShopifyConnectionManager from "./ShopifyConnectionManager.tsx";
import StoreSelector from "./StoreSelector.tsx";
import SyncDashboard from "./SyncDashboard.tsx";
import SyncHistory from "./SyncHistory.tsx";
import WebhookMonitor from "./WebhookMonitor.tsx";
import AutomationCenter from "./AutomationCenter.tsx";

interface ShopifySyncCenterProps {
  workspaceId: string;
  workspace: Workspace | null;
  onWorkspaceRefresh: () => Promise<void> | void;
}

export default function ShopifySyncCenter({
  workspaceId,
  workspace,
  onWorkspaceRefresh,
}: ShopifySyncCenterProps) {
  const [overview, setOverview] = useState<ShopifySyncOverview | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = async () => {
    const res = await fetch(`/api/shopify/overview?workspaceId=${workspaceId}`);
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || "Failed to load Shopify overview.");
      return;
    }
    setOverview(payload);
    setSelectedStoreId((current) => current || payload.stores[0]?.id);
    setError(null);
    await onWorkspaceRefresh();
  };

  useEffect(() => {
    fetchOverview();
  }, [workspaceId]);

  const selectedStore = useMemo<ShopifyStoreConnection | undefined>(
    () => overview?.stores.find((store) => store.id === selectedStoreId) || overview?.stores[0],
    [overview, selectedStoreId]
  );

  const selectedSettings = useMemo<ShopifyAutomationSettings | undefined>(
    () => overview?.automationSettings.find((settings) => settings.storeId === selectedStore?.id),
    [overview, selectedStore]
  );

  const filteredJobs = useMemo(
    () => overview?.jobs.filter((job) => !selectedStore || job.storeId === selectedStore.id) || [],
    [overview, selectedStore]
  );

  const filteredEvents = useMemo(
    () => overview?.webhooks.filter((event) => !selectedStore || event.storeId === selectedStore.id) || [],
    [overview, selectedStore]
  );

  const filteredRuns = useMemo(
    () => overview?.automationRuns.filter((run) => !selectedStore || run.storeId === selectedStore.id) || [],
    [overview, selectedStore]
  );

  if (!overview) {
    return (
      <div className="bg-slate-950 border border-slate-900 rounded-xl p-6 text-white">
        Loading Shopify live sync center...
      </div>
    );
  }

  return (
    <div className="bg-slate-950 border border-slate-900 rounded-xl p-6 text-white flex flex-col gap-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-900 pb-5">
        <div>
          <span className="text-xs font-mono text-emerald-400 uppercase tracking-widest">Shopify Live Sync & Automation</span>
          <h3 className="text-xl font-bold mt-1">Workspace Shopify Control Plane</h3>
          <p className="text-xs text-slate-400 mt-2">
            Connect stores, monitor real-time webhooks, manage the synchronization queue, and automate downstream marketing execution.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-400">
            Workspace {workspace?.name || workspaceId} · Stores {overview.analytics.connectedStores}
          </div>
          <button
            onClick={fetchOverview}
            className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 text-sm font-semibold flex items-center gap-2"
          >
            <RefreshCcw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-950/40 border border-rose-500/30 rounded-lg p-3 text-xs text-rose-300">{error}</div>
      )}

      <SyncDashboard analytics={overview.analytics} />

      <StoreSelector
        stores={overview.stores}
        selectedStoreId={selectedStore?.id}
        onSelect={setSelectedStoreId}
      />

      <ShopifyConnectionManager
        stores={overview.stores}
        workspaceId={workspaceId}
        selectedStoreId={selectedStore?.id}
        onRefresh={fetchOverview}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <WebhookMonitor
          store={selectedStore}
          events={filteredEvents}
          workspaceId={workspaceId}
          onRefresh={fetchOverview}
        />
        <AutomationCenter
          store={selectedStore}
          settings={selectedSettings}
          runs={filteredRuns}
          workspaceId={workspaceId}
          onRefresh={fetchOverview}
        />
      </div>

      <SyncHistory jobs={filteredJobs} />
    </div>
  );
}
