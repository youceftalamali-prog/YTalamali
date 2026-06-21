import React, { useEffect, useMemo, useState } from "react";
import { Clock3, Coins, Film, Layers3 } from "lucide-react";
import {
  ContentGenerationRecord,
  NormalizedProduct,
  ProviderHealthMetric,
  VideoAspectRatio,
  VideoGenerationRecord,
  VideoInputMode,
  VideoOutputType,
  VideoProviderName,
  VideoStudioAnalytics,
  VideoTemplateName,
} from "../../types.ts";
import ProviderManager from "./ProviderManager.tsx";
import VideoGenerator from "./VideoGenerator.tsx";
import VideoPreviewPlayer from "./VideoPreviewPlayer.tsx";
import VideoHistory from "./VideoHistory.tsx";
import RenderQueue from "./RenderQueue.tsx";

interface VideoStudioProps {
  selectedProduct: NormalizedProduct;
  workspaceId: string;
}

interface ProviderDescriptor {
  name: VideoProviderName;
  label: string;
  mode: "sandbox" | "live";
}

interface ProviderPayload {
  providers: ProviderDescriptor[];
  fallbackChain: VideoProviderName[];
  templates: VideoTemplateName[];
}

export default function VideoStudio({
  selectedProduct,
  workspaceId,
}: VideoStudioProps) {
  const [providerData, setProviderData] = useState<ProviderPayload | null>(null);
  const [latestVideo, setLatestVideo] = useState<VideoGenerationRecord | null>(null);
  const [history, setHistory] = useState<VideoGenerationRecord[]>([]);
  const [queue, setQueue] = useState<VideoGenerationRecord[]>([]);
  const [analytics, setAnalytics] = useState<VideoStudioAnalytics | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string>("");
  const [template, setTemplate] = useState<VideoTemplateName>("product_showcase");
  const [outputType, setOutputType] = useState<VideoOutputType>("short_form_vertical");
  const [inputMode, setInputMode] = useState<VideoInputMode>("product_data");
  const [provider, setProvider] = useState<VideoProviderName>("google_veo");
  const [prompt, setPrompt] = useState(`Create a premium AI video for ${selectedProduct.title}.`);
  const [durationSeconds, setDurationSeconds] = useState<number>(30);
  const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>("9:16");
  const [sourceImages, setSourceImages] = useState<string>([selectedProduct.images, ...selectedProduct.gallery].filter(Boolean).join(", "));
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = async () => {
    const providerRes = await fetch("/api/video/providers");
    const latestRes = await fetch(`/api/video/${selectedProduct.id}?workspaceId=${workspaceId}`);
    const historyRes = await fetch(`/api/video/history/${selectedProduct.id}?workspaceId=${workspaceId}`);
    const queueRes = await fetch(`/api/video/queue/${selectedProduct.id}?workspaceId=${workspaceId}`);
    const analyticsRes = await fetch(`/api/video/analytics/${selectedProduct.id}?workspaceId=${workspaceId}`);
    const contentRes = await fetch(`/api/content/${selectedProduct.id}`);

    if (providerRes.ok) {
      const providerPayload = await providerRes.json() as ProviderPayload;
      setProviderData(providerPayload);
      if (providerPayload.providers.length > 0) {
        setProvider((current) => current || providerPayload.providers[0].name);
      }
    }
    if (latestRes.ok) {
      const payload = await latestRes.json();
      setLatestVideo(payload.latest || null);
      if (payload.latest?.id) {
        setSelectedVideoId(payload.latest.id);
      }
    }
    if (historyRes.ok) {
      const payload = await historyRes.json();
      setHistory(payload.history || []);
    }
    if (queueRes.ok) {
      const payload = await queueRes.json();
      setQueue(payload.queue || []);
    }
    if (analyticsRes.ok) {
      setAnalytics(await analyticsRes.json());
    }
    if (contentRes.ok) {
      const payload = await contentRes.json() as { latest?: ContentGenerationRecord };
      if (payload.latest?.payload) {
        const nextPrompt = `Create a ${template.replace(/_/g, " ")} video for ${selectedProduct.title} using the latest product hooks, scripts, and brand positioning.`;
        setPrompt((current) => current || nextPrompt);
      }
    }
  };

  useEffect(() => {
    fetchAll();
  }, [selectedProduct.id, workspaceId]);

  useEffect(() => {
    const hasActiveQueue = queue.some((item) => item.status === "queued" || item.status === "rendering");
    if (!hasActiveQueue) {
      return;
    }
    const timer = setInterval(() => {
      fetchAll();
    }, 2500);
    return () => clearInterval(timer);
  }, [queue, selectedProduct.id, workspaceId]);

  const selectedVideo = useMemo(() => (
    history.find((item) => item.id === selectedVideoId) || latestVideo
  ), [history, latestVideo, selectedVideoId]);

  const providerPerformance: ProviderHealthMetric[] = analytics?.providerPerformance || [];

  const handleGenerate = async () => {
    setError(null);
    setFeedback(null);
    const res = await fetch("/api/video/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        productId: selectedProduct.id,
        template,
        outputType,
        inputMode,
        prompt,
        durationSeconds,
        aspectRatio,
        provider,
        sourceImageUrls: sourceImages.split(",").map((item) => item.trim()).filter(Boolean),
      }),
    });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || "Failed to generate AI video.");
      return;
    }
    setFeedback("Queued AI video render successfully.");
    await fetchAll();
  };

  const handleDelete = async (videoId: string) => {
    const res = await fetch(`/api/video/${videoId}?workspaceId=${workspaceId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const payload = await res.json();
      setError(payload.error || "Failed to delete AI video.");
      return;
    }
    setFeedback("Deleted AI video generation.");
    await fetchAll();
  };

  return (
    <div className="bg-slate-950 border border-slate-900 rounded-xl p-6 text-white flex flex-col gap-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-900 pb-5">
        <div>
          <span className="text-xs font-mono text-indigo-400 uppercase tracking-widest">AI Video Studio</span>
          <h3 className="text-xl font-bold mt-1">{selectedProduct.title}</h3>
          <p className="text-xs text-slate-400 mt-2">
            Generate AI videos from product data, prompts, or images using provider fallback, queue processing, progress tracking, version history, and downloadable outputs.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-rose-950/40 border border-rose-500/30 rounded-lg p-3 text-xs text-rose-300">{error}</div>
      )}
      {feedback && (
        <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-lg p-3 text-xs text-emerald-300">{feedback}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-indigo-300" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Generated Videos</span>
          </div>
          <p className="text-3xl font-bold text-white mt-3">{analytics?.generatedVideos || 0}</p>
        </div>
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <Clock3 className="w-4 h-4 text-emerald-300" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Avg Render Time</span>
          </div>
          <p className="text-3xl font-bold text-white mt-3">{analytics?.averageRenderTime || 0}s</p>
        </div>
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-300" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Credits Used</span>
          </div>
          <p className="text-3xl font-bold text-white mt-3">{analytics?.creditsUsed || 0}</p>
        </div>
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <Layers3 className="w-4 h-4 text-rose-300" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Completed / Failed</span>
          </div>
          <p className="text-3xl font-bold text-white mt-3">{analytics?.completedVideos || 0} / {analytics?.failedVideos || 0}</p>
        </div>
      </div>

      <ProviderManager
        selectedProvider={provider}
        providers={providerData?.providers || []}
        performance={providerPerformance}
        onChange={setProvider}
      />

      <VideoGenerator
        template={template}
        outputType={outputType}
        inputMode={inputMode}
        provider={provider}
        prompt={prompt}
        durationSeconds={durationSeconds}
        aspectRatio={aspectRatio}
        sourceImages={sourceImages}
        onChange={(field, value) => {
          if (field === "template") setTemplate(value as VideoTemplateName);
          if (field === "outputType") setOutputType(value as VideoOutputType);
          if (field === "inputMode") setInputMode(value as VideoInputMode);
          if (field === "provider") setProvider(value as VideoProviderName);
          if (field === "prompt") setPrompt(value);
          if (field === "durationSeconds") setDurationSeconds(Number(value));
          if (field === "aspectRatio") setAspectRatio(value as VideoAspectRatio);
          if (field === "sourceImages") setSourceImages(value);
        }}
        onGenerate={handleGenerate}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <VideoPreviewPlayer video={selectedVideo} onDelete={handleDelete} />
        <RenderQueue items={queue} />
      </div>

      <VideoHistory
        items={history}
        selectedId={selectedVideoId}
        onSelect={(video) => setSelectedVideoId(video.id)}
      />
    </div>
  );
}
