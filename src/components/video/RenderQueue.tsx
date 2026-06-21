import React from "react";
import { VideoGenerationRecord } from "../../types.ts";

interface RenderQueueProps {
  items: VideoGenerationRecord[];
}

export default function RenderQueue({ items }: RenderQueueProps) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">RenderQueue</h3>
        <p className="text-xs text-slate-400 mt-1">Track draft, queued, rendering, and failed video jobs with live progress indicators.</p>
      </div>
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div key={item.id} className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {item.provider} | {item.status} | ETA {item.estimatedRenderSeconds}s
                </p>
              </div>
              <span className="text-sm font-bold text-indigo-300">{item.progress}%</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-slate-950 overflow-hidden">
              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${item.progress}%` }} />
            </div>
            {item.errorMessage && (
              <p className="text-xs text-rose-300 mt-3">{item.errorMessage}</p>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl p-4">
            Render queue is empty.
          </div>
        )}
      </div>
    </div>
  );
}
