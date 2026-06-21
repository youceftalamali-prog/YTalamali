import React from "react";
import { SocialAccount, SocialPlatform } from "../../types.ts";

interface PlatformSelectorProps {
  selectedPlatforms: SocialPlatform[];
  connectedAccounts: SocialAccount[];
  onToggle: (platform: SocialPlatform) => void;
}

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  pinterest: "Pinterest",
  x: "X",
  linkedin: "LinkedIn",
  youtube_shorts: "YouTube Shorts",
};

export default function PlatformSelector({
  selectedPlatforms,
  connectedAccounts,
  onToggle,
}: PlatformSelectorProps) {
  const connectedSet = new Set(connectedAccounts.map((account) => account.platform));

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {(Object.keys(PLATFORM_LABELS) as SocialPlatform[]).map((platform) => {
        const isSelected = selectedPlatforms.includes(platform);
        const isConnected = connectedSet.has(platform);
        return (
          <button
            key={platform}
            type="button"
            onClick={() => onToggle(platform)}
            className={`p-3 rounded-lg border text-left transition ${
              isSelected
                ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-200"
                : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold">{PLATFORM_LABELS[platform]}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                isConnected ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"
              }`}>
                {isConnected ? "Connected" : "Sandbox"}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
