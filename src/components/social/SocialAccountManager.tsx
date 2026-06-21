import React, { useState } from "react";
import { Plug2, Trash2 } from "lucide-react";
import { SocialAccount, SocialPlatform } from "../../types.ts";

interface SocialAccountManagerProps {
  accounts: SocialAccount[];
  onConnect: (payload: {
    platform: SocialPlatform;
    username: string;
    platformUserId: string;
    accessToken?: string;
  }) => Promise<void>;
  onDelete: (accountId: string) => Promise<void>;
}

const PLATFORMS: SocialPlatform[] = [
  "facebook",
  "instagram",
  "tiktok",
  "pinterest",
  "x",
  "linkedin",
  "youtube_shorts",
];

export default function SocialAccountManager({
  accounts,
  onConnect,
  onDelete,
}: SocialAccountManagerProps) {
  const [platform, setPlatform] = useState<SocialPlatform>("instagram");
  const [username, setUsername] = useState("");
  const [platformUserId, setPlatformUserId] = useState("");
  const [accessToken, setAccessToken] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !platformUserId.trim()) {
      return;
    }
    await onConnect({
      platform,
      username: username.trim(),
      platformUserId: platformUserId.trim(),
      accessToken: accessToken.trim() || undefined,
    });
    setUsername("");
    setPlatformUserId("");
    setAccessToken("");
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
      <form onSubmit={submit} className="xl:col-span-2 bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">SocialAccountManager</h3>
          <p className="text-xs text-slate-400 mt-1">Connect sandbox or live publishing accounts for each platform.</p>
        </div>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as SocialPlatform)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
        >
          {PLATFORMS.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
        />
        <input
          value={platformUserId}
          onChange={(e) => setPlatformUserId(e.target.value)}
          placeholder="Platform user ID"
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
        />
        <input
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          placeholder="Optional live access token"
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
        />
        <button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
        >
          <Plug2 className="w-4 h-4" /> Connect Account
        </button>
      </form>

      <div className="xl:col-span-3 bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Connected Accounts</h3>
          <p className="text-xs text-slate-400 mt-1">Live accounts use provided tokens when `SOCIAL_PUBLISH_LIVE=true`; otherwise posts run in sandbox mode.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {accounts.map((account) => (
            <div key={account.id} className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-slate-100 font-semibold capitalize">{account.platform.replace("_", " ")}</p>
                <p className="text-xs text-slate-400 mt-1">@{account.username}</p>
                <p className="text-[11px] text-slate-500 mt-2">
                  Mode: <span className="text-indigo-300">{account.integrationMode}</span>
                </p>
              </div>
              <button
                onClick={() => onDelete(account.id)}
                className="p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-rose-300 hover:border-rose-500/30"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {accounts.length === 0 && (
            <div className="text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl p-4">
              No social accounts connected yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
