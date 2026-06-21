import React, { useMemo } from "react";
import { Eye, Send, Save, CalendarDays, Layers3 } from "lucide-react";
import {
  SocialAccount,
  SocialContentSuggestion,
  SocialPlatform,
} from "../../types.ts";
import PlatformSelector from "./PlatformSelector.tsx";

interface PostComposerProps {
  title: string;
  caption: string;
  hashtagsText: string;
  mediaUrlsText: string;
  scheduledAt: string;
  selectedPlatforms: SocialPlatform[];
  selectedSuggestionIds: string[];
  suggestions: SocialContentSuggestion[];
  accounts: SocialAccount[];
  onChange: (field: "title" | "caption" | "hashtagsText" | "mediaUrlsText" | "scheduledAt", value: string) => void;
  onTogglePlatform: (platform: SocialPlatform) => void;
  onToggleSuggestion: (suggestionId: string) => void;
  onSubmit: (action: "draft" | "schedule" | "publish") => Promise<void>;
}

export default function PostComposer({
  title,
  caption,
  hashtagsText,
  mediaUrlsText,
  scheduledAt,
  selectedPlatforms,
  selectedSuggestionIds,
  suggestions,
  accounts,
  onChange,
  onTogglePlatform,
  onToggleSuggestion,
  onSubmit,
}: PostComposerProps) {
  const selectedSuggestionText = useMemo(() => (
    suggestions
      .filter((item) => selectedSuggestionIds.includes(item.id))
      .map((item) => item.text)
      .join("\n\n")
  ), [selectedSuggestionIds, suggestions]);

  const previewCaption = selectedSuggestionText || caption;
  const hashtags = hashtagsText
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.startsWith("#") ? item : `#${item}`);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
      <div className="xl:col-span-7 bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">PostComposer</h3>
          <p className="text-xs text-slate-400 mt-1">Compose drafts, publish immediately, schedule posts, or bulk publish across multiple platforms.</p>
        </div>

        <input
          value={title}
          onChange={(e) => onChange("title", e.target.value)}
          placeholder="Post title"
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
        />

        <textarea
          value={caption}
          onChange={(e) => onChange("caption", e.target.value)}
          placeholder="Write your post caption here..."
          rows={6}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            value={hashtagsText}
            onChange={(e) => onChange("hashtagsText", e.target.value)}
            placeholder="hashtags, separated, by, commas"
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
          />
          <input
            value={mediaUrlsText}
            onChange={(e) => onChange("mediaUrlsText", e.target.value)}
            placeholder="Media URLs, separated, by, commas"
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[10px] uppercase tracking-widest font-mono text-slate-500">PlatformSelector</span>
          <PlatformSelector
            selectedPlatforms={selectedPlatforms}
            connectedAccounts={accounts}
            onToggle={onTogglePlatform}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] uppercase tracking-widest font-mono text-slate-500">Bulk Source Suggestions</span>
            <span className="text-[11px] text-slate-500">{selectedSuggestionIds.length} selected</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
            {suggestions.map((suggestion) => {
              const selected = selectedSuggestionIds.includes(suggestion.id);
              return (
                <button
                  key={suggestion.id}
                  type="button"
                  onClick={() => onToggleSuggestion(suggestion.id)}
                  className={`text-left rounded-lg border p-3 transition ${
                    selected
                      ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-100"
                      : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold">{suggestion.label}</span>
                    <span className="text-[10px] font-mono uppercase text-slate-500">{suggestion.type}</span>
                  </div>
                  <p className="text-xs mt-2 text-slate-400 line-clamp-3">{suggestion.text}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <label className="md:col-span-2 flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-widest font-mono text-slate-500">Schedule Time</span>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => onChange("scheduledAt", e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
            />
          </label>
          <button
            onClick={() => onSubmit("draft")}
            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-100 px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" /> Save Drafts
          </button>
          <button
            onClick={() => onSubmit("schedule")}
            className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-200 px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
          >
            <CalendarDays className="w-4 h-4" /> Schedule
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => onSubmit("publish")}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" /> Publish Immediately
          </button>
          <div className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-xs text-slate-400 flex items-center gap-2">
            <Layers3 className="w-4 h-4 text-indigo-300" />
            Selecting multiple platforms and multiple suggestions creates a bulk publishing batch.
          </div>
        </div>
      </div>

      <div className="xl:col-span-5 bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-indigo-300" />
          <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Post Preview</h3>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-white">{title || "Untitled social post"}</span>
            <span className="text-[10px] font-mono text-slate-500">{selectedPlatforms.length} platforms</span>
          </div>
          <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
            {previewCaption || "Your caption preview will appear here."}
          </p>
          {hashtags.length > 0 && (
            <p className="text-xs text-indigo-300 leading-relaxed">{hashtags.join(" ")}</p>
          )}
          {mediaUrlsText.trim() && (
            <div className="text-[11px] text-slate-500">
              Media: {mediaUrlsText.split(",").map((item) => item.trim()).filter(Boolean).length} assets
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
