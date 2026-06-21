import React, { useEffect, useMemo, useState } from "react";
import { RefreshCcw, Trash2 } from "lucide-react";
import { QueueOverview, Workspace } from "../../types.ts";
import QueueDashboard from "./QueueDashboard.tsx";
import WorkerMonitor from "./WorkerMonitor.tsx";
import JobHistory from "./JobHistory.tsx";
import DeadLetterQueue from "./DeadLetterQueue.tsx";
import QueueAnalytics from "./QueueAnalytics.tsx";

interface QueueCenterProps {
  workspaceId: string;
  workspace: Workspace | null;
  onWorkspaceRefresh: () => Promise<void> | void;
}

export default function QueueCenter({
  workspaceId,
  workspace,
  onWorkspaceRefresh,
}: QueueCenterProps) {
  const [overview, setOverview] = useState<QueueOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchOverview = async () => {
    const res = await fetch(`/api/queue/overview?workspaceId=${workspaceId}`);
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || "Failed to load queue overview.");
      return;
    }
    setOverview(payload);
    setError(null);
    await onWorkspaceRefresh();
  };

  useEffect(() => {
    fetchOverview();
    const interval = window.setInterval(fetchOverview, 2000);
    return () => window.clearInterval(interval);
  }, [workspaceId]);

  const actOnJob = async (jobId: string, action: "retry" | "cancel") => {
    const res = await fetch(`/api/queue/jobs/${jobId}/${action}`, {
      method: "POST",
    });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || `Failed to ${action} job.`);
      return;
    }
    setFeedback(`Job ${action} request accepted.`);
    await fetchOverview();
  };

  const runCleanup = async () => {
    const res = await fetch("/api/queue/cleanup", { method: "POST" });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || "Failed to clean queue records.");
      return;
    }
    setFeedback("Queue cleanup policy executed.");
    await fetchOverview();
  };

  const sortedJobs = useMemo(
    () => overview?.jobs.slice().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()) || [],
    [overview]
  );

  if (!overview) {
    return (
      <div className="bg-slate-950 border border-slate-900 rounded-xl p-6 text-white">
        Loading queue center...
      </div>
    );
  }

  return (
    <div className="bg-slate-950 border border-slate-900 rounded-xl p-6 text-white flex flex-col gap-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-900 pb-5">
        <div>
          <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest">Background Workers & Production Queue Engine</span>
          <h3 className="text-xl font-bold mt-1">Operations Queue Center</h3>
          <p className="text-xs text-slate-400 mt-2">
            Monitor imports, Shopify sync, content generation, video rendering, social publishing, automation execution, and competitor monitoring from one control plane.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-400">
            Workspace {workspace?.name || workspaceId} · Active jobs {overview.activeJobs.length}
          </div>
          <button
            onClick={fetchOverview}
            className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 text-sm font-semibold flex items-center gap-2"
          >
            <RefreshCcw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={runCleanup}
            className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 text-sm font-semibold flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Cleanup
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-950/40 border border-rose-500/30 rounded-lg p-3 text-xs text-rose-300">{error}</div>
      )}
      {feedback && (
        <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-lg p-3 text-xs text-emerald-300">{feedback}</div>
      )}

      <QueueDashboard analytics={overview.analytics} />
      <WorkerMonitor workers={overview.workers} />
      <QueueAnalytics analytics={overview.analytics} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <DeadLetterQueue jobs={overview.deadLetterJobs} onRetry={(jobId) => actOnJob(jobId, "retry")} />
        <JobHistory
          jobs={sortedJobs.filter((job) => job.status === "completed" || job.status === "failed" || job.status === "cancelled").slice(0, 12)}
          onRetry={(jobId) => actOnJob(jobId, "retry")}
          onCancel={(jobId) => actOnJob(jobId, "cancel")}
        />
      </div>

      <JobHistory
        jobs={sortedJobs}
        onRetry={(jobId) => actOnJob(jobId, "retry")}
        onCancel={(jobId) => actOnJob(jobId, "cancel")}
      />
    </div>
  );
}
