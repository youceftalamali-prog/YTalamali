import React, { useEffect, useMemo, useState } from "react";
import { Check, Copy, Images, Layers3, Sparkles, Wand2 } from "lucide-react";
import { ContentGenerationRecord, NormalizedProduct, ProductAnalysis } from "../types.ts";

interface ImageStudioProps {
  selectedProduct: NormalizedProduct | null;
  workspaceId: string;
}

interface PromptCard {
  id: string;
  label: string;
  aspectRatio: string;
  prompt: string;
}

export default function ImageStudio({
  selectedProduct,
  workspaceId,
}: ImageStudioProps) {
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);
  const [content, setContent] = useState<ContentGenerationRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchImageStudioSources = async () => {
      if (!selectedProduct?.id) {
        setAnalysis(null);
        setContent(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const [analysisRes, contentRes] = await Promise.all([
          fetch(`/api/intelligence/analysis?productId=${selectedProduct.id}`),
          fetch(`/api/content/${selectedProduct.id}`),
        ]);

        if (analysisRes.ok) {
          const payload = await analysisRes.json();
          setAnalysis(payload.latest || null);
        }

        if (contentRes.ok) {
          const payload = await contentRes.json();
          setContent(payload.latest || null);
        }
      } catch (err) {
        console.error("Failed to load image studio sources:", err);
        setError("Failed to load image studio inputs.");
      } finally {
        setLoading(false);
      }
    };

    fetchImageStudioSources();
  }, [selectedProduct?.id, workspaceId]);

  const imageAssets = useMemo(() => {
    if (!selectedProduct) return [];
    return [selectedProduct.images, ...selectedProduct.gallery].filter(Boolean);
  }, [selectedProduct]);

  const hooks = useMemo(() => {
    const payload = content?.payload as Record<string, any> | undefined;
    return Array.isArray(payload?.hooks)
      ? payload.hooks.map((item: any) => item?.content).filter(Boolean)
      : [];
  }, [content]);

  const prompts = useMemo<PromptCard[]>(() => {
    if (!selectedProduct) return [];

    const voice = analysis?.brandIntelligence?.toneOfVoiceAnalysis?.primaryTone || "premium, trustworthy";
    const visualDirection = analysis?.brandIntelligence?.brandIdentityGenerator?.visualDirection?.join(", ") || "clean studio lighting, premium ecommerce styling";
    const colorMood = analysis?.brandIntelligence?.brandIdentityGenerator?.colorMood?.join(", ") || "neutral, high-contrast, conversion-focused";
    const valueProp = analysis?.brandIntelligence?.brandPositioning?.valueProposition || selectedProduct.description;
    const primaryHook = hooks[0] || `Highlight the most compelling reason to buy ${selectedProduct.title}`;
    const persona = analysis?.brandIntelligence?.customerPersonaGeneration?.[0]?.personaName || "high-intent ecommerce shopper";

    return [
      {
        id: "hero-square",
        label: "Hero Ad Creative",
        aspectRatio: "1:1",
        prompt: `Create a premium ecommerce hero image for ${selectedProduct.title} by ${selectedProduct.vendor}. Show the product as the main subject with ${visualDirection}. Use a ${voice} brand voice translated into visuals, with ${colorMood}. Emphasize this value proposition: ${valueProp}. Overlay-ready composition, sharp focus, realistic product materials, high conversion intent, square campaign format.`,
      },
      {
        id: "story-vertical",
        label: "Story / Reel Cover",
        aspectRatio: "9:16",
        prompt: `Design a vertical mobile-first campaign visual for ${selectedProduct.title}. Audience: ${persona}. Composition should support a short-form ad or story cover, with bold focal framing, strong negative space for copy, and motion-friendly lighting. Visual message: ${primaryHook}. Style cues: ${visualDirection}. Keep it premium, scroll-stopping, and product-led.`,
      },
      {
        id: "lifestyle-landscape",
        label: "Lifestyle Banner",
        aspectRatio: "16:9",
        prompt: `Produce a widescreen lifestyle banner for ${selectedProduct.title}. Place the product in a believable usage context for a ${persona}. Express ${voice} brand energy, include ${colorMood}, and visually communicate ${valueProp}. Cinematic lighting, polished ecommerce photography, ample headline space, landscape banner composition.`,
      },
      {
        id: "ugc-carousel",
        label: "UGC Carousel Frame",
        aspectRatio: "4:5",
        prompt: `Generate a user-generated-style social ad image for ${selectedProduct.title}. Make it authentic but elevated, focused on benefits and purchase confidence. Use cues from this hook: ${primaryHook}. Blend ${visualDirection} with a trustworthy creator aesthetic, crisp product visibility, and clear emotional payoff for the buyer.`,
      },
    ];
  }, [analysis, hooks, selectedProduct]);

  const shotList = useMemo(() => {
    if (!selectedProduct) return [];

    return [
      `Clean packshot of ${selectedProduct.title} on a seamless background`,
      `Close-up detail shot showing build quality, texture, and premium finish`,
      `Lifestyle usage scene that demonstrates the product outcome`,
      `Social-first composition with negative space for hook text and CTA`,
    ];
  }, [selectedProduct]);

  const handleCopy = async (id: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 1600);
  };

  if (!selectedProduct) {
    return (
      <div className="bg-slate-950 border border-slate-900 rounded-xl p-8 text-center text-white">
        Select a product to open Image Studio.
      </div>
    );
  }

  return (
    <div className="bg-slate-950 border border-slate-900 rounded-xl p-6 text-white flex flex-col gap-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-900 pb-5">
        <div>
          <span className="text-xs font-mono text-fuchsia-400 uppercase tracking-widest">Image Studio</span>
          <h3 className="text-xl font-bold mt-1">{selectedProduct.title}</h3>
          <p className="text-xs text-slate-400 mt-2 max-w-3xl">
            Build image campaign prompts, shot lists, and asset boards from imported product data, brand intelligence, and the latest content generation history.
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-300">
          Product assets {imageAssets.length} · Prompt packs {prompts.length}
        </div>
      </div>

      {error && (
        <div className="bg-rose-950/40 border border-rose-500/30 rounded-lg p-3 text-xs text-rose-300">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-300">
            <Images className="w-4 h-4 text-fuchsia-300" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Assets</span>
          </div>
          <p className="text-3xl font-bold mt-3">{imageAssets.length}</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-300">
            <Wand2 className="w-4 h-4 text-indigo-300" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Prompt Packs</span>
          </div>
          <p className="text-3xl font-bold mt-3">{prompts.length}</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-300">
            <Sparkles className="w-4 h-4 text-emerald-300" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Creative Hooks</span>
          </div>
          <p className="text-3xl font-bold mt-3">{hooks.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Layers3 className="w-4 h-4 text-indigo-300" />
            <h4 className="text-sm font-semibold">Source asset board</h4>
          </div>
          {loading ? (
            <p className="text-xs text-slate-400">Loading image inputs...</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {imageAssets.map((asset, index) => (
                <img
                  key={`${asset}-${index}`}
                  src={asset}
                  alt={`${selectedProduct.title} asset ${index + 1}`}
                  className="w-full h-32 rounded-lg object-cover border border-slate-800 bg-slate-950"
                  referrerPolicy="no-referrer"
                />
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-fuchsia-300" />
            <h4 className="text-sm font-semibold">Recommended shot list</h4>
          </div>
          <div className="flex flex-col gap-3">
            {shotList.map((item, index) => (
              <div key={item} className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-200">
                <span className="text-xs font-mono text-fuchsia-400 mr-2">SHOT {index + 1}</span>
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {prompts.map((item) => (
          <div key={item.id} className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{item.label}</p>
                <p className="text-[11px] font-mono uppercase tracking-widest text-slate-500 mt-1">Aspect ratio {item.aspectRatio}</p>
              </div>
              <button
                onClick={() => handleCopy(item.id, item.prompt)}
                className="shrink-0 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 flex items-center gap-2"
              >
                {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedId === item.id ? "Copied" : "Copy prompt"}
              </button>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{item.prompt}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
