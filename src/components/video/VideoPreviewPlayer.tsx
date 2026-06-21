import React from "react";
import { Download, Trash2 } from "lucide-react";
import { VideoGenerationRecord } from "../../types.ts";

interface VideoPreviewPlayerProps {
  video: VideoGenerationRecord | null;
  onDelete: (videoId: string) => Promise<void>;
}

export default function VideoPreviewPlayer({
  video,
  onDelete,
}: VideoPreviewPlayerProps) {
  if (!video) {
    return (
      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-6 text-center text-sm text-slate-500">
        No rendered video available yet.
      </div>
    );
  }

  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">VideoPreviewPlayer</h3>
          <p className="text-xs text-slate-400 mt-1">{video.title}</p>
        </div>
        <div className="flex gap-2">
          {video.downloadUrl && (
            <a
              href={video.downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-slate-100 text-xs font-semibold flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Download
            </a>
          )}
          <button
            onClick={() => onDelete(video.id)}
            className="px-3 py-2 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-200 text-xs font-semibold flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      </div>

      {video.videoUrl ? (
        <video
          controls
          poster={video.thumbnailUrl}
          className="w-full rounded-xl border border-slate-800 bg-black max-h-[420px]"
          src={video.videoUrl}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">
          This video is still rendering.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3">
          <span className="text-slate-500 uppercase font-mono text-[10px]">Provider</span>
          <p className="text-white mt-1">{video.provider}</p>
        </div>
        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3">
          <span className="text-slate-500 uppercase font-mono text-[10px]">Status</span>
          <p className="text-white mt-1">{video.status}</p>
        </div>
        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3">
          <span className="text-slate-500 uppercase font-mono text-[10px]">Duration</span>
          <p className="text-white mt-1">{video.durationSeconds}s</p>
        </div>
        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3">
          <span className="text-slate-500 uppercase font-mono text-[10px]">Credits</span>
          <p className="text-white mt-1">{video.creditsUsed}</p>
        </div>
      </div>
    </div>
  );
}
