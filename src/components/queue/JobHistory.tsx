import React from "react";
import { QueueJobRecord } from "../../types.ts";

interface JobHistoryProps {
  jobs: QueueJobRecord[];
  onRetry: (jobId: string) => Promise<void>;
  onCancel: (jobId: string) => Promise<void>;
}

export default function JobHistory({ jobs, onRetry, onCancel }: JobHistoryProps) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">JobHistory</h3>
        <p className="text-xs text-slate-400 mt-1">Review active, completed, retrying, failed, and cancelled jobs across every queue type.</p>
      </div>

      <div className="flex flex-col gap-3 max-h-[420px] overflow-y-auto">
        {jobs.map((job) => {
          const actionable = job.status === "failed" || job.status === "retrying" || job.status === "queued" || job.status === "pending";
          return (
            <div key={job.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-white font-semibold uppercase">{job.kind.replace(/_/g, " ")}</p>
                  <p className="text-slate-400 mt-1">{job.workerName} · attempt {job.attemptCount}/{job.maxAttempts}</p>
                </div>
                <span className="px-2 py-1 rounded-full bg-slate-950 border border-slate-800 text-slate-300 text-[10px] font-mono uppercase">
                  {job.status}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-slate-500">
                <span>Priority: {job.priority}</span>
                <span>Backoff: {job.backoffMs} ms</span>
                <span>Processing: {job.processingTimeMs || 0} ms</span>
                <span>{new Date(job.updatedAt).toLocaleString()}</span>
              </div>

              {job.lastError && (
                <p className="text-rose-300 mt-3">{job.lastError}</p>
              )}

              {actionable && (
                <div className="flex gap-2 mt-3">
                  {(job.status === "failed" || job.status === "retrying") && (
                    <button
                      onClick={() => onRetry(job.id)}
                      className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold"
                    >
                      Retry
                    </button>
                  )}
                  {(job.status === "pending" || job.status === "queued" || job.status === "retrying") && (
                    <button
                      onClick={() => onCancel(job.id)}
                      className="px-3 py-1.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-200 text-[11px] font-semibold"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {jobs.length === 0 && (
          <div className="border border-dashed border-slate-800 rounded-xl p-4 text-xs text-slate-500">
            No queue jobs recorded yet.
          </div>
        )}
      </div>
    </div>
  );
}
