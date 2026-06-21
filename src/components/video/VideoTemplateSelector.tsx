import React from "react";
import { VideoTemplateName } from "../../types.ts";

interface VideoTemplateSelectorProps {
  value: VideoTemplateName;
  onChange: (template: VideoTemplateName) => void;
}

const TEMPLATES: Array<{ id: VideoTemplateName; label: string; description: string }> = [
  { id: "product_showcase", label: "Product Showcase", description: "Highlight the product, benefits, and polished brand visuals." },
  { id: "ugc_testimonial", label: "UGC Testimonial", description: "Creator-style proof and customer-led endorsements." },
  { id: "problem_solution", label: "Problem / Solution", description: "Show the pain point first, then present the product answer." },
  { id: "before_after", label: "Before / After", description: "Demonstrate transformation and outcome-focused change." },
  { id: "unboxing", label: "Unboxing", description: "Reveal packaging, product details, and tactile experience." },
  { id: "luxury_brand_ad", label: "Luxury Brand Ad", description: "Cinematic premium visuals and elevated brand tone." },
  { id: "storytelling_ad", label: "Storytelling Ad", description: "Narrative-led promotional video with emotional build-up." },
];

export default function VideoTemplateSelector({
  value,
  onChange,
}: VideoTemplateSelectorProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      {TEMPLATES.map((template) => {
        const selected = template.id === value;
        return (
          <button
            key={template.id}
            type="button"
            onClick={() => onChange(template.id)}
            className={`rounded-xl border p-4 text-left transition ${
              selected
                ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-100"
                : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
            }`}
          >
            <p className="text-sm font-semibold">{template.label}</p>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">{template.description}</p>
          </button>
        );
      })}
    </div>
  );
}
