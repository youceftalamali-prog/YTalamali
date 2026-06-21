import React from "react";
import { WorkspaceCreditBucket } from "../../types.ts";

interface UsageMeterProps {
  bucket: WorkspaceCreditBucket;
  onUpgrade: () => void;
}

export default function UsageMeter({ bucket, onUpgrade }: UsageMeterProps) {
  const percentage = bucket.monthlyAllocation > 0
    ? Math.min(100, Math.round((bucket.usedThisPeriod / bucket.monthlyAllocation) * 100))
    : 0;
  const depleted = bucket.balance <= 0;

  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white">{bucket.label}</h3>
          <p className="text-xs text-slate-400 mt-1">
            {bucket.balance} remaining of {bucket.monthlyAllocation} monthly credits.
          </p>
        </div>
        <span className={`px-2 py-1 rounded-full text-[10px] font-mono uppercase border ${
          depleted
            ? "bg-rose-500/10 border-rose-500/20 text-rose-300"
            : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
        }`}>
          {depleted ? "Exhausted" : `${percentage}% used`}
        </span>
      </div>

      <div className="h-2 rounded-full bg-slate-900 overflow-hidden">
        <div
          className={`h-full rounded-full ${depleted ? "bg-rose-500" : "bg-indigo-500"}`}
          style={{ width: `${Math.max(6, percentage)}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Used this period: {bucket.usedThisPeriod}</span>
        {depleted && (
          <button
            onClick={onUpgrade}
            className="px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold"
          >
            Upgrade
          </button>
        )}
      </div>
    </div>
  );
}
