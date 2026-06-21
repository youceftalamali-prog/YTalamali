import React, { useMemo } from "react";
import { SocialPost } from "../../types.ts";

interface ContentCalendarProps {
  posts: SocialPost[];
}

export default function ContentCalendar({ posts }: ContentCalendarProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, SocialPost[]>();
    posts.forEach((post) => {
      const key = (post.scheduledAt || post.publishedAt || post.createdAt).slice(0, 10);
      const current = map.get(key) || [];
      current.push(post);
      map.set(key, current);
    });
    return Array.from(map.entries()).sort(([left], [right]) => left.localeCompare(right));
  }, [posts]);

  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">ContentCalendar</h3>
        <p className="text-xs text-slate-400 mt-1">Calendar view of scheduled, published, and draft social content.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {grouped.map(([date, items]) => (
          <div key={date} className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <p className="text-xs font-mono text-indigo-300 mb-3">{date}</p>
            <div className="flex flex-col gap-2">
              {items.map((post) => (
                <div key={post.id} className="bg-slate-950/70 border border-slate-800 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-slate-100 capitalize">{post.platform.replace("_", " ")}</span>
                    <span className="text-[10px] font-mono text-slate-500 uppercase">{post.status}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 line-clamp-3">{post.caption}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
        {grouped.length === 0 && (
          <div className="text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl p-4">
            No posts available for the content calendar yet.
          </div>
        )}
      </div>
    </div>
  );
}
