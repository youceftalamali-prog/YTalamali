import React from "react";
import { Activity, CheckCircle2, CircleOff, Gauge, TriangleAlert } from "lucide-react";
import { QueueAnalytics } from "../../types.ts";

interface QueueDashboardProps {
  analytics: QueueAnalytics;
}

const cards = [
  { key: "activeJobs", label: "Active Jobs", icon: Activity, accent: "text-cyan-300" },
  { key: "completedJobs", label: "Completed Jobs", icon: CheckCircle2, accent: "text-emerald-300" },
  { key: "failedJobs", label: "Failed Jobs", icon: TriangleAlert, accent: "text-rose-300" },
  { key: "throughputPerHour", label: "Throughput / Hour", icon: Gauge, accent: "text-indigo-300" },
] as const;

export default function QueueDashboard({ analytics }: QueueDashboardProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">QueueDashboard</h3>
        <p className="text-xs text-slate-400 mt-1">Track active workloads, throughput, failures, and average execution time across all workers.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          const value = analytics[card.key];
          return (
            <div key={card.key} className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${card.accent}`} />
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">{card.label}</span>
              </div>
              <p className="text-3xl font-bold text-white mt-3">{value}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-2">
          <CircleOff className="w-4 h-4 text-amber-300" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Average Execution Time</span>
        </div>
        <p className="text-3xl font-bold text-white mt-3">{analytics.averageExecutionTimeMs} ms</p>
      </div>
    </div>
  );
}
