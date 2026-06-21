import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, MousePointerClick, Radio, Users } from "lucide-react";
import {
  ContentGenerationRecord,
  NormalizedProduct,
  SocialAccount,
  SocialContentSuggestion,
  SocialPlatform,
  SocialPost,
  SocialPublishingAnalytics,
} from "../../types.ts";
import SocialAccountManager from "./SocialAccountManager.tsx";
import PostComposer from "./PostComposer.tsx";
import ContentCalendar from "./ContentCalendar.tsx";
import PublishQueue from "./PublishQueue.tsx";
import PostHistory from "./PostHistory.tsx";

interface SocialPublishingCenterProps {
  selectedProduct: NormalizedProduct;
  workspaceId: string;
}

function toLocalDateTimeInput(date: Date): string {
  const pad = (value: number) => `${value}`.padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function SocialPublishingCenter({
  selectedProduct,
  workspaceId,
}: SocialPublishingCenterProps) {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [suggestions, setSuggestions] = useState<SocialContentSuggestion[]>([]);
  const [latestGeneration, setLatestGeneration] = useState<ContentGenerationRecord | null>(null);
  const [calendarPosts, setCalendarPosts] = useState<SocialPost[]>([]);
  const [queuePosts, setQueuePosts] = useState<SocialPost[]>([]);
  const [historyPosts, setHistoryPosts] = useState<SocialPost[]>([]);
  const [analytics, setAnalytics] = useState<SocialPublishingAnalytics | null>(null);
  const [title, setTitle] = useState(`${selectedProduct.title} social launch`);
  const [caption, setCaption] = useState("");
  const [hashtagsText, setHashtagsText] = useState(selectedProduct.vendor ? `${selectedProduct.vendor},aurapost` : "aurapost");
  const [mediaUrlsText, setMediaUrlsText] = useState([selectedProduct.images, ...selectedProduct.gallery].filter(Boolean).join(", "));
  const [scheduledAt, setScheduledAt] = useState(toLocalDateTimeInput(new Date(Date.now() + 3600000)));
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>(["instagram", "facebook"]);
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = async () => {
    const accountUrl = `/api/publishing/accounts?workspaceId=${workspaceId}`;
    const sourceUrl = `/api/publishing/content-sources?productId=${selectedProduct.id}`;
    const calendarUrl = `/api/publishing/posts/calendar?workspaceId=${workspaceId}&productId=${selectedProduct.id}`;
    const queueUrl = `/api/publishing/posts/queue?workspaceId=${workspaceId}&productId=${selectedProduct.id}`;
    const historyUrl = `/api/publishing/posts/history?workspaceId=${workspaceId}&productId=${selectedProduct.id}`;
    const analyticsUrl = `/api/publishing/analytics?workspaceId=${workspaceId}&productId=${selectedProduct.id}`;

    const [accountRes, sourceRes, calendarRes, queueRes, historyRes, analyticsRes] = await Promise.all([
      fetch(accountUrl),
      fetch(sourceUrl),
      fetch(calendarUrl),
      fetch(queueUrl),
      fetch(historyUrl),
      fetch(analyticsUrl),
    ]);

    if (accountRes.ok) {
      const payload = await accountRes.json();
      setAccounts(payload.accounts || []);
    }
    if (sourceRes.ok) {
      const payload = await sourceRes.json();
      setSuggestions(payload.suggestions || []);
      setLatestGeneration(payload.latestGeneration || null);
      if ((payload.suggestions || []).length > 0 && !caption) {
        setCaption(payload.suggestions[0].text);
      }
    }
    if (calendarRes.ok) {
      setCalendarPosts((await calendarRes.json()).posts || []);
    }
    if (queueRes.ok) {
      setQueuePosts((await queueRes.json()).posts || []);
    }
    if (historyRes.ok) {
      setHistoryPosts((await historyRes.json()).posts || []);
    }
    if (analyticsRes.ok) {
      setAnalytics(await analyticsRes.json());
    }
  };

  useEffect(() => {
    fetchAll();
  }, [selectedProduct.id, workspaceId]);

  const togglePlatform = (platform: SocialPlatform) => {
    setSelectedPlatforms((current) => (
      current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform]
    ));
  };

  const toggleSuggestion = (suggestionId: string) => {
    setSelectedSuggestionIds((current) => (
      current.includes(suggestionId)
        ? current.filter((item) => item !== suggestionId)
        : [...current, suggestionId]
    ));
  };

  const handleConnectAccount = async (payload: {
    platform: SocialPlatform;
    username: string;
    platformUserId: string;
    accessToken?: string;
  }) => {
    setError(null);
    const res = await fetch("/api/publishing/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        ...payload,
      }),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error || "Failed to connect social account.");
      return;
    }
    setFeedback(`Connected ${payload.platform} account @${payload.username}.`);
    await fetchAll();
  };

  const handleDeleteAccount = async (accountId: string) => {
    await fetch(`/api/publishing/accounts/${accountId}?workspaceId=${workspaceId}`, {
      method: "DELETE",
    });
    setFeedback("Removed social account.");
    await fetchAll();
  };

  const handleSubmit = async (action: "draft" | "schedule" | "publish") => {
    setError(null);
    setFeedback(null);
    const res = await fetch("/api/publishing/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        productId: selectedProduct.id,
        title,
        caption,
        hashtags: hashtagsText.split(",").map((item) => item.trim()).filter(Boolean),
        mediaUrls: mediaUrlsText.split(",").map((item) => item.trim()).filter(Boolean),
        platforms: selectedPlatforms,
        action,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        selectedSuggestionIds,
        contentSuggestions: suggestions,
      }),
    });

    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || "Failed to save social posts.");
      return;
    }

    setFeedback(
      action === "publish"
        ? `Queued ${payload.posts.length} post(s) for publishing.`
        : action === "schedule"
          ? `Scheduled ${payload.posts.length} post(s).`
          : `Saved ${payload.posts.length} draft(s).`
    );
    await fetchAll();
  };

  const handlePublishSingle = async (postId: string) => {
    setError(null);
    const res = await fetch(`/api/publishing/posts/${postId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || "Failed to publish post.");
      return;
    }
    setFeedback("Publishing queue updated.");
    await fetchAll();
  };

  const platformRows = useMemo(() => analytics?.platformPerformance || [], [analytics]);

  return (
    <div className="bg-slate-950 border border-slate-900 rounded-xl p-6 text-white flex flex-col gap-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-900 pb-5">
        <div>
          <span className="text-xs font-mono text-indigo-400 uppercase tracking-widest">Social Publishing Center</span>
          <h3 className="text-xl font-bold mt-1">{selectedProduct.title}</h3>
          <p className="text-xs text-slate-400 mt-2">
            Create social posts, save drafts, schedule queue items, publish immediately, manage connected accounts, and monitor platform performance.
          </p>
        </div>
        {latestGeneration && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-400">
            Source content version <span className="text-indigo-300 font-semibold">V{latestGeneration.version}</span> loaded from Content Studio.
          </div>
        )}
      </div>

      {error && (
        <div className="bg-rose-950/40 border border-rose-500/30 rounded-lg p-3 text-xs text-rose-300">
          {error}
        </div>
      )}
      {feedback && (
        <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-lg p-3 text-xs text-emerald-300">
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-indigo-300" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Published Posts</span>
          </div>
          <p className="text-3xl font-bold text-white mt-3">{analytics?.publishedPosts || 0}</p>
        </div>
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-300" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Engagement</span>
          </div>
          <p className="text-3xl font-bold text-white mt-3">{analytics?.engagement || 0}</p>
        </div>
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-300" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Reach</span>
          </div>
          <p className="text-3xl font-bold text-white mt-3">{analytics?.reach || 0}</p>
        </div>
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <MousePointerClick className="w-4 h-4 text-rose-300" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Clicks</span>
          </div>
          <p className="text-3xl font-bold text-white mt-3">{analytics?.clicks || 0}</p>
        </div>
      </div>

      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Platform Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mt-4">
          {platformRows.map((row) => (
            <div key={row.platform} className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
              <p className="text-slate-100 font-semibold capitalize">{row.platform.replace("_", " ")}</p>
              <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                <div>
                  <span className="text-slate-500 uppercase font-mono text-[10px]">Posts</span>
                  <p className="text-white mt-1">{row.posts}</p>
                </div>
                <div>
                  <span className="text-slate-500 uppercase font-mono text-[10px]">Reach</span>
                  <p className="text-white mt-1">{row.reach}</p>
                </div>
                <div>
                  <span className="text-slate-500 uppercase font-mono text-[10px]">Engagement</span>
                  <p className="text-white mt-1">{row.engagement}</p>
                </div>
                <div>
                  <span className="text-slate-500 uppercase font-mono text-[10px]">Clicks</span>
                  <p className="text-white mt-1">{row.clicks}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <SocialAccountManager
        accounts={accounts}
        onConnect={handleConnectAccount}
        onDelete={handleDeleteAccount}
      />

      <PostComposer
        title={title}
        caption={caption}
        hashtagsText={hashtagsText}
        mediaUrlsText={mediaUrlsText}
        scheduledAt={scheduledAt}
        selectedPlatforms={selectedPlatforms}
        selectedSuggestionIds={selectedSuggestionIds}
        suggestions={suggestions}
        accounts={accounts}
        onChange={(field, value) => {
          if (field === "title") setTitle(value);
          if (field === "caption") setCaption(value);
          if (field === "hashtagsText") setHashtagsText(value);
          if (field === "mediaUrlsText") setMediaUrlsText(value);
          if (field === "scheduledAt") setScheduledAt(value);
        }}
        onTogglePlatform={togglePlatform}
        onToggleSuggestion={toggleSuggestion}
        onSubmit={handleSubmit}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ContentCalendar posts={calendarPosts} />
        <PublishQueue posts={queuePosts} onPublish={handlePublishSingle} />
      </div>

      <PostHistory posts={historyPosts} />
    </div>
  );
}
