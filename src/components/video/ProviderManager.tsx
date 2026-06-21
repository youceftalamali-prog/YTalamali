import React from "react";
import { ProviderHealthMetric, VideoProviderName } from "../../types.ts";

interface ProviderManagerProps {
  selectedProvider: VideoProviderName;
  providers: Array<{ name: VideoProviderName; label: string; mode: "sandbox" | "live" }>;
  performance: ProviderHealthMetric[];
  onChange: (provider: VideoProviderName) => void;
}

export default function ProviderManager({
  selectedProvider,
  providers,
  performance,
  onChange,
}: ProviderManagerProps) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">ProviderManager</h3>
        <p className="text-xs text-slate-400 mt-1">Choose the preferred video provider while preserving automatic fallback order.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {providers.map((provider) => {
          const metric = performance.find((item) => item.provider === provider.name);
          const selected = provider.name === selectedProvider;
          return (
            <button
              key={provider.name}
              type="button"
              onClick={() => onChange(provider.name)}
              className={`rounded-xl border p-4 text-left transition ${
                selected
                  ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-100"
                  : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{provider.label}</p>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
                  {provider.mode}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                <div>
                  <span className="text-slate-500 uppercase font-mono text-[10px]">Avg Time</span>
                  <p className="text-white mt-1">{metric?.averageRenderTime ?? 0}s</p>
                </div>
                <div>
                  <span className="text-slate-500 uppercase font-mono text-[10px]">Success</span>
                  <p className="text-white mt-1">{metric?.successRate ?? 100}%</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
