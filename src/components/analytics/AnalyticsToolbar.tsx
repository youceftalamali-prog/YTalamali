import React from "react";
import { Download, FileSpreadsheet, FileText, FileType2 } from "lucide-react";
import { AnalyticsDatePreset } from "../../types.ts";

interface AnalyticsToolbarProps {
  preset: AnalyticsDatePreset;
  customStartDate: string;
  customEndDate: string;
  loading: boolean;
  onPresetChange: (preset: AnalyticsDatePreset) => void;
  onCustomStartDateChange: (value: string) => void;
  onCustomEndDateChange: (value: string) => void;
  onExport: (format: "csv" | "excel" | "pdf") => void;
}

const FILTERS: Array<{ id: AnalyticsDatePreset; label: string }> = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 Days" },
  { id: "30d", label: "30 Days" },
  { id: "90d", label: "90 Days" },
  { id: "custom", label: "Custom Range" },
];

export default function AnalyticsToolbar({
  preset,
  customStartDate,
  customEndDate,
  loading,
  onPresetChange,
  onCustomStartDateChange,
  onCustomEndDateChange,
  onExport,
}: AnalyticsToolbarProps) {
  return (
    <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              onClick={() => onPresetChange(filter.id)}
              disabled={loading}
              className={`px-3 py-2 rounded-lg border text-xs font-mono transition ${
                preset === filter.id
                  ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-200"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onExport("csv")}
            className="px-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-slate-200 text-xs font-mono flex items-center gap-2 hover:border-slate-700"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-300" /> CSV
          </button>
          <button
            onClick={() => onExport("excel")}
            className="px-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-slate-200 text-xs font-mono flex items-center gap-2 hover:border-slate-700"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" /> Excel
          </button>
          <button
            onClick={() => onExport("pdf")}
            className="px-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-slate-200 text-xs font-mono flex items-center gap-2 hover:border-slate-700"
          >
            <FileType2 className="w-3.5 h-3.5 text-rose-300" /> PDF
          </button>
        </div>
      </div>

      {preset === "custom" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-widest font-mono text-slate-500">Start Date</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => onCustomStartDateChange(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-widest font-mono text-slate-500">End Date</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => onCustomEndDateChange(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
            />
          </label>
          <div className="text-xs text-slate-400 leading-relaxed bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 flex items-center gap-2">
            <Download className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
            Custom ranges update the entire analytics center and all export formats.
          </div>
        </div>
      )}
    </div>
  );
}
