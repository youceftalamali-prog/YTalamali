import React from "react";
import { QueueAnalytics as QueueAnalyticsType } from "../../types.ts";

interface QueueAnalyticsProps {
  analytics: QueueAnalyticsType;
}

export default function QueueAnalytics({ analytics }: QueueAnalyticsProps) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">QueueAnalytics</h3>
        <p className="text-xs text-slate-400 mt-1">Break down pending, processing, completed, and failed counts across each queue kind.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
        {analytics.queueLengthByKind.map((item) => (
          <div key={item.kind} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs">
            <p className="text-white font-semibold uppercase">{item.kind.replace(/_/g, " ")}</p>
            <div className="grid grid-cols-2 gap-2 mt-3 text-slate-400">
              <span>Pending: {item.pending}</span>
              <span>Processing: {item.processing}</span>
              <span>Completed: {item.completed}</span>
              <span>Failed: {item.failed}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
