import React from "react";
import { SocialPost } from "../../types.ts";

interface PostHistoryProps {
  posts: SocialPost[];
}

export default function PostHistory({ posts }: PostHistoryProps) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">PostHistory</h3>
        <p className="text-xs text-slate-400 mt-1">Track draft, scheduled, published, and failed posts with platform metrics and external IDs.</p>
      </div>
      <div className="flex flex-col gap-3 max-h-[420px] overflow-y-auto pr-1">
        {posts.map((post) => (
          <div key={post.id} className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <p className="text-slate-100 font-semibold capitalize">{post.platform.replace("_", " ")}</p>
                <p className="text-xs text-slate-500 mt-1">{new Date(post.createdAt).toLocaleString()}</p>
              </div>
              <span className="text-[10px] font-mono uppercase px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300">
                {post.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-3 whitespace-pre-wrap">{post.caption}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-xs">
              <div>
                <span className="text-slate-500 uppercase font-mono text-[10px]">Reach</span>
                <p className="text-white mt-1">{post.metrics.reach}</p>
              </div>
              <div>
                <span className="text-slate-500 uppercase font-mono text-[10px]">Engagement</span>
                <p className="text-white mt-1">{post.metrics.engagement}</p>
              </div>
              <div>
                <span className="text-slate-500 uppercase font-mono text-[10px]">Clicks</span>
                <p className="text-white mt-1">{post.metrics.clicks}</p>
              </div>
              <div>
                <span className="text-slate-500 uppercase font-mono text-[10px]">External ID</span>
                <p className="text-white mt-1 break-all">{post.externalPostId || "N/A"}</p>
              </div>
            </div>
          </div>
        ))}
        {posts.length === 0 && (
          <div className="text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl p-4">
            No social publishing history yet.
          </div>
        )}
      </div>
    </div>
  );
}
