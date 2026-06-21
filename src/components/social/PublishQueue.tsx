import React from "react";
import { PlayCircle } from "lucide-react";
import { SocialPost } from "../../types.ts";

interface PublishQueueProps {
  posts: SocialPost[];
  onPublish: (postId: string) => Promise<void>;
}

export default function PublishQueue({ posts, onPublish }: PublishQueueProps) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">PublishQueue</h3>
        <p className="text-xs text-slate-400 mt-1">Monitor scheduled, publishing, and failed posts, then manually re-run publishing when needed.</p>
      </div>
      <div className="flex flex-col gap-3">
        {posts.map((post) => (
          <div key={post.id} className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <p className="text-slate-100 font-semibold capitalize">{post.platform.replace("_", " ")}</p>
              <p className="text-xs text-slate-400 mt-1">{post.caption.slice(0, 140)}</p>
              <p className="text-[11px] text-slate-500 mt-2">
                Status: {post.status} {post.scheduledAt ? `| Scheduled ${new Date(post.scheduledAt).toLocaleString()}` : ""}
              </p>
            </div>
            <button
              onClick={() => onPublish(post.id)}
              className="px-3 py-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-200 text-xs font-semibold flex items-center justify-center gap-2"
            >
              <PlayCircle className="w-4 h-4" /> Publish Now
            </button>
          </div>
        ))}
        {posts.length === 0 && (
          <div className="text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl p-4">
            Publishing queue is empty.
          </div>
        )}
      </div>
    </div>
  );
}
