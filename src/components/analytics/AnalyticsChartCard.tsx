import React, { ReactNode } from "react";

interface AnalyticsChartCardProps {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}

export default function AnalyticsChartCard({
  title,
  description,
  actions,
  children,
}: AnalyticsChartCardProps) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col gap-4">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">{title}</h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">{description}</p>
        </div>
        {actions}
      </div>
      <div className="min-h-[260px]">{children}</div>
    </div>
  );
}
