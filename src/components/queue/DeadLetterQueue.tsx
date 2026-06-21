import React from "react";
import { DeadLetterJob } from "../../types.ts";

interface DeadLetterQueueProps {
  jobs: DeadLetterJob[];
  onRetry: (jobId: string) => Promise<void>;
}

export default function DeadLetterQueue({ jobs, onRetry }: DeadLetterQueueProps) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">DeadLetterQueue</h3>
        <p className="text-xs text-slate-400 mt-1">Inspect exhausted jobs that exceeded max retry attempts and require manual intervention.</p>
      </div>

      <div className="flex flex-col gap-3 max-h-[320px] overflow-y-auto">
        {jobs.map((job) => (
          <div key={job.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-white font-semibold uppercase">{job.kind.replace(/_/g, " ")}</p>
                <p className="text-slate-400 mt-1">{job.workerName} · attempts {job.attempts}</p>
              </div>
              <button
                onClick={() => onRetry(job.sourceJobId)}
                className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold"
              >
                Retry Source Job
              </button>
            </div>
            <p className="text-rose-300 mt-3">{job.lastError}</p>
            <p className="text-slate-500 mt-3">{new Date(job.movedAt).toLocaleString()}</p>
          </div>
        ))}
        {jobs.length === 0 && (
          <div className="border border-dashed border-slate-800 rounded-xl p-4 text-xs text-slate-500">
            Dead-letter queue is empty.
          </div>
        )}
      </div>
    </div>
  );
}
