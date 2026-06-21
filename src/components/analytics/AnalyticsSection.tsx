import React, { ReactNode } from "react";

interface AnalyticsSectionProps {
  title: string;
  description: string;
  children: ReactNode;
}

export default function AnalyticsSection({
  title,
  description,
  children,
}: AnalyticsSectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider">{title}</h2>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{description}</p>
      </div>
      {children}
    </section>
  );
}
