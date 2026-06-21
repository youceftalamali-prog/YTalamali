import React, { useState } from "react";
import { ShopifyStoreConnection } from "../../types.ts";

interface ShopifyConnectionManagerProps {
  stores: ShopifyStoreConnection[];
  workspaceId: string;
  selectedStoreId?: string;
  onRefresh: () => Promise<void>;
}

export default function ShopifyConnectionManager({
  stores,
  workspaceId,
  selectedStoreId,
  onRefresh,
}: ShopifyConnectionManagerProps) {
  const [shopDomain, setShopDomain] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const selectedStore = stores.find((store) => store.id === selectedStoreId) || stores[0];

  const connectStore = async () => {
    setFeedback(null);
    const startRes = await fetch("/api/shopify/oauth/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopDomain }),
    });
    const startPayload = await startRes.json();
    if (!startRes.ok) {
      setFeedback(startPayload.error || "Failed to start Shopify OAuth.");
      return;
    }

    const callbackRes = await fetch("/api/shopify/oauth/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        shopDomain,
        code: `sandbox-code-${Date.now()}`,
        state: startPayload.state,
      }),
    });
    const callbackPayload = await callbackRes.json();
    if (!callbackRes.ok) {
      setFeedback(callbackPayload.error || "Failed to connect Shopify store.");
      return;
    }
    setFeedback(`Connected ${shopDomain} in ${callbackPayload.store.connectionMode} mode.`);
    setShopDomain("");
    await onRefresh();
  };

  const performAction = async (action: "disconnect" | "reconnect" | "refresh-token" | "sync") => {
    if (!selectedStore) {
      return;
    }
    const res = await fetch(`/api/shopify/stores/${selectedStore.id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    });
    const payload = await res.json();
    if (!res.ok) {
      setFeedback(payload.error || `Failed to ${action} store.`);
      return;
    }
    setFeedback(`${action} completed for ${selectedStore.shopDomain}.`);
    await onRefresh();
  };

  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">ShopifyConnectionManager</h3>
        <p className="text-xs text-slate-400 mt-1">
          Connect unlimited Shopify stores, simulate OAuth in sandbox mode, and manage reconnect or token refresh flows.
        </p>
      </div>

      {feedback && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs text-slate-300">{feedback}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr,1fr] gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
          <label className="text-xs text-slate-400">Shop Domain</label>
          <input
            value={shopDomain}
            onChange={(e) => setShopDomain(e.target.value)}
            placeholder="brand.myshopify.com"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
          />
          <button
            onClick={connectStore}
            className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold"
          >
            Connect Store
          </button>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
          <span className="text-xs text-slate-400">Selected Store Actions</span>
          <button
            onClick={() => performAction("sync")}
            disabled={!selectedStore}
            className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-sm font-semibold"
          >
            Run Full Sync
          </button>
          <button
            onClick={() => performAction("refresh-token")}
            disabled={!selectedStore}
            className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 disabled:text-slate-600 text-slate-200 text-sm font-semibold"
          >
            Refresh Token
          </button>
          <button
            onClick={() => performAction("reconnect")}
            disabled={!selectedStore}
            className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 disabled:text-slate-600 text-slate-200 text-sm font-semibold"
          >
            Reconnect
          </button>
          <button
            onClick={() => performAction("disconnect")}
            disabled={!selectedStore}
            className="px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 disabled:text-slate-600 text-rose-200 text-sm font-semibold"
          >
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
}
