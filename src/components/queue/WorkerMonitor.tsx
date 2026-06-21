import React from "react";
import { WorkerHealthSnapshot } from "../../types.ts";

interface WorkerMonitorProps {
  workers: WorkerHealthSnapshot[];
}

export default function WorkerMonitor({ workers }: WorkerMonitorProps) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">WorkerMonitor</h3>
        <p className="text-xs text-slate-400 mt-1">Inspect worker status, memory usage, queue length, failure counts, and processing latency.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
        {workers.map((worker) => (
          <div key={worker.workerName} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-white font-semibold">{worker.workerName}</h4>
              <span className={`px-2 py-1 rounded-full border text-[10px] font-mono uppercase ${
                worker.status === "running"
                  ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-300"
                  : worker.status === "idle"
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/20 text-rose-300"
              }`}>
                {worker.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4 text-slate-400">
              <span>Memory: {worker.memoryUsageMb} MB</span>
              <span>Queue: {worker.queueLength}</span>
              <span>Processed: {worker.processedJobs}</span>
              <span>Failed: {worker.failedJobs}</span>
              <span>Avg: {worker.averageProcessingTimeMs} ms</span>
              <span>{new Date(worker.lastHeartbeatAt).toLocaleTimeString()}</span>
            </div>

            {worker.activeJobId && (
              <p className="text-slate-500 mt-3 break-all">Active job: {worker.activeJobId}</p>
            )}
          </div>
        ))}
        {workers.length === 0 && (
          <div className="border border-dashed border-slate-800 rounded-xl p-4 text-xs text-slate-500">
            No worker heartbeats recorded yet.
          </div>
        )}
      </div>
    </div>
  );
}
