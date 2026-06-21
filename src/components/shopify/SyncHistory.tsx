import React from "react";
import { ShopifySyncJob } from "../../types.ts";

interface SyncHistoryProps {
  jobs: ShopifySyncJob[];
}

export default function SyncHistory({ jobs }: SyncHistoryProps) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">SyncHistory</h3>
        <p className="text-xs text-slate-400 mt-1">Review synchronization queue state changes across products, collections, inventory, orders, and customers.</p>
      </div>

      <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto">
        {jobs.map((job) => (
          <div key={job.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-white font-semibold uppercase">{job.scope}</p>
                <p className="text-slate-400 mt-1">{job.summary}</p>
              </div>
              <span className="px-2 py-1 rounded-full bg-slate-950 border border-slate-800 text-slate-300 text-[10px] font-mono uppercase">
                {job.status}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-slate-500">
              <span>Products: {job.syncedProducts}</span>
              <span>Orders: {job.importedOrders}</span>
              <span>Customers: {job.importedCustomers}</span>
              <span>Revenue: ${job.revenueImported.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between mt-3 text-slate-500">
              <span>{new Date(job.createdAt).toLocaleString()}</span>
              <span>{job.trigger}</span>
            </div>
            {job.errorMessage && (
              <div className="mt-3 text-rose-300">{job.errorMessage}</div>
            )}
          </div>
        ))}
        {jobs.length === 0 && (
          <div className="border border-dashed border-slate-800 rounded-xl p-4 text-xs text-slate-500">
            No sync jobs recorded yet.
          </div>
        )}
      </div>
    </div>
  );
}
