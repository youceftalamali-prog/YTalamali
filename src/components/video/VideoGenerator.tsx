import React from "react";
import {
  VideoAspectRatio,
  VideoInputMode,
  VideoOutputType,
  VideoProviderName,
  VideoTemplateName,
} from "../../types.ts";
import VideoTemplateSelector from "./VideoTemplateSelector.tsx";

interface VideoGeneratorProps {
  template: VideoTemplateName;
  outputType: VideoOutputType;
  inputMode: VideoInputMode;
  provider: VideoProviderName;
  prompt: string;
  durationSeconds: number;
  aspectRatio: VideoAspectRatio;
  sourceImages: string;
  onChange: (
    field: "template" | "outputType" | "inputMode" | "provider" | "prompt" | "durationSeconds" | "aspectRatio" | "sourceImages",
    value: string
  ) => void;
  onGenerate: () => Promise<void>;
}

export default function VideoGenerator({
  template,
  outputType,
  inputMode,
  provider,
  prompt,
  durationSeconds,
  aspectRatio,
  sourceImages,
  onChange,
  onGenerate,
}: VideoGeneratorProps) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">VideoGenerator</h3>
        <p className="text-xs text-slate-400 mt-1">Generate AI videos from product data, text prompts, or product images across short-form and long-form formats.</p>
      </div>

      <VideoTemplateSelector
        value={template}
        onChange={(value) => onChange("template", value)}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <select
          value={outputType}
          onChange={(e) => onChange("outputType", e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
        >
          <option value="ugc_style_ad">UGC Style Ad</option>
          <option value="slideshow">Slideshow</option>
          <option value="talking_avatar">Talking Avatar</option>
          <option value="short_form_vertical">Short-Form Vertical</option>
          <option value="long_form_promotional">Long-Form Promotional</option>
        </select>

        <select
          value={inputMode}
          onChange={(e) => onChange("inputMode", e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
        >
          <option value="product_data">Product Data</option>
          <option value="text_prompt">Text Prompt</option>
          <option value="product_images">Product Images</option>
        </select>

        <select
          value={aspectRatio}
          onChange={(e) => onChange("aspectRatio", e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
        >
          <option value="9:16">9:16 Vertical</option>
          <option value="16:9">16:9 Landscape</option>
          <option value="1:1">1:1 Square</option>
        </select>

        <input
          type="number"
          min={15}
          max={180}
          value={durationSeconds}
          onChange={(e) => onChange("durationSeconds", e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
        />
      </div>

      <div className="grid grid-cols-1 gap-3">
        <textarea
          value={prompt}
          onChange={(e) => onChange("prompt", e.target.value)}
          rows={4}
          placeholder="Describe the AI video you want to generate..."
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
        />
        <textarea
          value={sourceImages}
          onChange={(e) => onChange("sourceImages", e.target.value)}
          rows={3}
          placeholder="Comma-separated image URLs for product-image and slideshow workflows"
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-slate-400">
          Preferred provider: <span className="text-indigo-300">{provider}</span>
        </div>
        <button
          onClick={onGenerate}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-semibold"
        >
          Generate Video
        </button>
      </div>
    </div>
  );
}
