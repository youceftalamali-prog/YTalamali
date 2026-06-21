import React from "react";
import { VideoGenerationRecord } from "../../types.ts";

interface VideoHistoryProps {
  items: VideoGenerationRecord[];
  selectedId?: string;
  onSelect: (video: VideoGenerationRecord) => void;
}

export default function VideoHistory({
  items,
  selectedId,
  onSelect,
}: VideoHistoryProps) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">VideoHistory</h3>
        <p className="text-xs text-slate-400 mt-1">Version history for drafts, renders, completed videos, and failed jobs.</p>
      </div>
      <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-1">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            className={`rounded-xl border p-4 text-left transition ${
              selectedId === item.id
                ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-100"
                : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{item.title}</p>
              <span className="text-[10px] font-mono uppercase">{item.status}</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              V{item.version} | {new Date(item.createdAt).toLocaleString()} | {item.provider}
            </p>
          </button>
        ))}
        {items.length === 0 && (
          <div className="text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl p-4">
            No AI video history yet.
          </div>
        )}
      </div>
    </div>
  );
}
