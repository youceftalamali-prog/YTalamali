import React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { AnalyticsKpi } from "../../types.ts";

interface AnalyticsKpiCardProps {
  item: AnalyticsKpi;
}

function formatValue(value: number, format: AnalyticsKpi["format"]): string {
  if (format === "currency") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  }

  if (format === "percent") {
    return `${value.toFixed(1)}%`;
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

export default function AnalyticsKpiCard({ item }: AnalyticsKpiCardProps) {
  const isPositive = item.change > 0;
  const isNegative = item.change < 0;

  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[10px] uppercase tracking-widest font-mono text-slate-500">{item.label}</span>
          <p className="text-2xl font-extrabold text-white mt-2">{formatValue(item.value, item.format)}</p>
        </div>
        <div className={`px-2 py-1 rounded-lg border text-[11px] font-mono flex items-center gap-1 ${
          isPositive
            ? "text-emerald-300 border-emerald-500/20 bg-emerald-500/10"
            : isNegative
              ? "text-rose-300 border-rose-500/20 bg-rose-500/10"
              : "text-slate-300 border-slate-700 bg-slate-900"
        }`}>
          {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : isNegative ? <ArrowDownRight className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
          {Math.abs(item.change).toFixed(1)}%
        </div>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">{item.helper}</p>
    </div>
  );
}
