import React, { useState } from "react";
import { ShopifyStoreConnection, ShopifyWebhookEvent, ShopifyWebhookTopic } from "../../types.ts";

interface WebhookMonitorProps {
  store?: ShopifyStoreConnection;
  events: ShopifyWebhookEvent[];
  workspaceId: string;
  onRefresh: () => Promise<void>;
}

const topics: ShopifyWebhookTopic[] = [
  "products/create",
  "products/update",
  "products/delete",
  "orders/create",
  "orders/updated",
  "app/uninstalled",
];

export default function WebhookMonitor({
  store,
  events,
  workspaceId,
  onRefresh,
}: WebhookMonitorProps) {
  const [feedback, setFeedback] = useState<string | null>(null);

  const triggerWebhook = async (topic: ShopifyWebhookTopic) => {
    if (!store) {
      return;
    }
    const payload = {
      id: `${store.id}-${topic.replace("/", "-")}-${Date.now()}`,
      topic,
      shopDomain: store.shopDomain,
    };
    const res = await fetch(`/api/shopify/webhooks/${store.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-shopify-topic": topic,
      },
      body: JSON.stringify({
        workspaceId,
        payload,
      }),
    });
    const response = await res.json();
    if (!res.ok) {
      setFeedback(response.error || "Failed to trigger webhook.");
      return;
    }
    setFeedback(`Triggered ${topic} webhook for ${store.shopDomain}.`);
    await onRefresh();
  };

  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">WebhookMonitor</h3>
        <p className="text-xs text-slate-400 mt-1">Inspect Shopify webhook traffic and simulate real-time sync triggers during sandbox testing.</p>
      </div>

      {feedback && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs text-slate-300">{feedback}</div>
      )}

      <div className="flex flex-wrap gap-2">
        {topics.map((topic) => (
          <button
            key={topic}
            onClick={() => triggerWebhook(topic)}
            disabled={!store}
            className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 disabled:text-slate-600 text-slate-200 text-xs font-semibold"
          >
            {topic}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 max-h-[320px] overflow-y-auto">
        {events.map((event) => (
          <div key={event.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="text-white font-semibold">{event.topic}</span>
              <span className="px-2 py-1 rounded-full bg-slate-950 border border-slate-800 text-slate-300 text-[10px] font-mono uppercase">
                {event.status}
              </span>
            </div>
            <p className="text-slate-500 mt-2">{new Date(event.createdAt).toLocaleString()}</p>
            {event.errorMessage && (
              <p className="text-rose-300 mt-2">{event.errorMessage}</p>
            )}
          </div>
        ))}
        {events.length === 0 && (
          <div className="border border-dashed border-slate-800 rounded-xl p-4 text-xs text-slate-500">
            No webhooks received yet.
          </div>
        )}
      </div>
    </div>
  );
}
