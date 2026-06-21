import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  History,
  Mail,
  FileText,
  Video,
  Megaphone,
  Coins,
  ArrowRight,
  Bookmark,
  ChevronDown,
  Info,
  Clock,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import { NormalizedProduct, ProductAnalysis } from "../types.ts";

interface ContentStudioProps {
  selectedProduct: NormalizedProduct;
  workspaceId: string;
  userCredits: number;
  onOperationSuccess: () => void;
}

export default function ContentStudio({
  selectedProduct,
  workspaceId,
  userCredits,
  onOperationSuccess
}: ContentStudioProps) {
  // Navigation inside content studio
  const [activeTab, setActiveTab] = useState<"hooks" | "scripts" | "adCopy" | "descriptions" | "emails" | "landingPage">("hooks");
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMess, setErrorMess] = useState<string | null>(null);
  const [successMess, setSuccessMess] = useState<string | null>(null);
  
  // Local states for loaded assets
  const [latestGeneration, setLatestGeneration] = useState<any | null>(null);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>("en");

  // Fetch both latest copy and history list
  const fetchContentAndHistory = async () => {
    if (!selectedProduct.id) return;
    try {
      // 1. Fetch latest content
      const resLatest = await fetch(`/api/content/${selectedProduct.id}`);
      if (resLatest.ok) {
        const dataLatest = await resLatest.json();
        setLatestGeneration(dataLatest.latest);
      }
      
      // 2. Fetch history
      const resHistory = await fetch(`/api/content/history/${selectedProduct.id}`);
      if (resHistory.ok) {
        const dataHistory = await resHistory.json();
        setHistoryList(dataHistory.history || []);
        if (dataHistory.history && dataHistory.history.length > 0) {
          // Set selection to current latest
          const latestItem = dataHistory.history.find((h: any) => h.isLatest);
          if (latestItem) {
            setSelectedHistoryId(latestItem.id);
          } else {
            setSelectedHistoryId(dataHistory.history[0].id);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching content details:", err);
    }
  };

  useEffect(() => {
    fetchContentAndHistory();
  }, [selectedProduct.id]);

  // Handle manual history selection change
  const handleHistorySelect = (id: string) => {
    setSelectedHistoryId(id);
    const selectedItem = historyList.find((h) => h.id === id);
    if (selectedItem) {
      // Temporarily hydrate latestGeneration payload with chosen historical revision
      setLatestGeneration(selectedItem);
      setSuccessMess(`Hydrated Content Studio with historical Version #${selectedItem.version}`);
      setTimeout(() => setSuccessMess(null), 3500);
    }
  };

  // Run Gemini Content Generation
  const triggerCopyGeneration = async (type: "hooks" | "scripts" | "package") => {
    if (!selectedProduct.id) return;
    setErrorMess(null);
    setSuccessMess(null);
    setIsGenerating(true);

    try {
      const res = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProduct.id,
          workspaceId,
          contentType: type,
          languageCode: language
        })
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Generation process failed.");
      }

      const data = await res.json();
      if (data.generation) {
        setLatestGeneration(data.generation);
      }
      setSuccessMess(
        data.queued
          ? `Queued ${type === "package" ? "full marketing suite" : type} generation.`
          : `Successfully generated ${type === "package" ? "full marketing suite" : type}!`
      );
      
      // Reload lists, update workspaces balance
      await fetchContentAndHistory();
      onOperationSuccess();
    } catch (err: any) {
      setErrorMess(err.message || "Something went wrong during generation.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper selectors to unpack payload safely
  const payload = latestGeneration?.payload || {};
  const hooksList = payload.hooks || [];
  const scriptsList = payload.scripts || [];
  const adCopyList = payload.adCopy || [];
  const descriptions = payload.descriptions || {};
  const emailsList = payload.emails || [];
  const landingPage = payload.landingPage || {};

  return (
    <div className="bg-slate-950 border border-slate-900 rounded-xl p-6 text-white font-sans max-w-7xl mx-auto" id="content_studio_panel">
      {/* HEADER BAR AND BALANCE CONTROLS */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between pb-6 border-b border-slate-900 gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 rounded bg-indigo-500/10 text-indigo-400">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </span>
            <h3 className="text-xl font-bold font-sans tracking-tight">AI Content Studio</h3>
          </div>
          <p className="text-xs text-slate-400">
            Generate and preserve premium, high-converting copy from the foundational product intelligence analysis.
          </p>
        </div>

        {/* CONTROLS */}
        <div className="flex flex-wrap items-center gap-3">
          {/* LANGAUGE */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-md px-2.5 py-1">
            <span className="text-[10px] font-mono text-slate-400 uppercase font-bold mr-1.5 select-none">Lang:</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-transparent text-xs font-mono font-bold text-indigo-400 outline-none cursor-pointer"
            >
              <option value="en" className="bg-slate-900 text-white">English</option>
              <option value="es" className="bg-slate-900 text-white">Español</option>
              <option value="fr" className="bg-slate-900 text-white">Français</option>
              <option value="de" className="bg-slate-900 text-white">Deutsch</option>
              <option value="it" className="bg-slate-900 text-white">Italiano</option>
              <option value="pt" className="bg-slate-900 text-white">Português</option>
            </select>
          </div>

          {/* CREDITS DISPLAY */}
          <div className="flex items-center gap-1.5 bg-indigo-950/40 border border-indigo-900/60 rounded-md px-3 py-1 text-xs select-none">
            <Coins className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-300 font-mono">Available Balance:</span>
            <span className="font-mono font-bold text-indigo-400">{userCredits} Credits</span>
          </div>
        </div>
      </div>

      {/* FEEDBACK BANNERS */}
      <AnimatePresence mode="popLayout">
        {errorMess && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-3 bg-rose-950/70 border border-rose-900 rounded-lg text-rose-300 text-xs flex items-center gap-2 mb-6"
            id="engine_error_container"
          >
            <span className="font-bold">Error:</span> {errorMess}
          </motion.div>
        )}
        {successMess && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-3 bg-emerald-950/70 border border-emerald-900 rounded-lg text-emerald-300 text-xs flex items-center gap-2 mb-6"
            id="engine_success_container"
          >
            <Check className="w-4 h-4" />
            <span>{successMess}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GENERATION STARTER SUITE */}
      <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-5 mb-8 flex flex-col md:flex-row items-center justify-between gap-6" id="generation_toolbox">
        <div className="max-w-xl">
          <h4 className="text-sm font-bold font-sans text-indigo-300 mb-1 flex items-center gap-1.5">
            <Coins className="w-4 h-4" />
            Spark High-Converting Content Engines
          </h4>
          <p className="text-xs text-slate-400 leading-normal">
            Select an isolated campaign segment to draft, or trigger the comprehensive omnichannel conversion machine. Each generation leverages Gemini text grounding and saves to historical version chains automatically.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            onClick={() => triggerCopyGeneration("hooks")}
            disabled={isGenerating}
            className="bg-slate-900 hover:bg-slate-850 text-slate-200 hover:text-white border border-slate-800 disabled:opacity-40 px-3.5 py-2 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5"
            id="gen_hooks_btn"
          >
            <span>🪝 Hooks</span>
            <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-1 py-0.5 rounded">5cr</span>
          </button>
          
          <button
            onClick={() => triggerCopyGeneration("scripts")}
            disabled={isGenerating}
            className="bg-slate-900 hover:bg-slate-850 text-slate-200 hover:text-white border border-slate-800 disabled:opacity-40 px-3.5 py-2 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5"
            id="gen_scripts_btn"
          >
            <span>🎬 Scripts</span>
            <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-1 py-0.5 rounded">10cr</span>
          </button>

          <button
            onClick={() => triggerCopyGeneration("package")}
            disabled={isGenerating}
            className="bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 px-4 py-2 rounded-lg text-xs font-mono font-bold transition flex items-center gap-2 shadow-lg shadow-indigo-600/10"
            id="gen_package_btn"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Full Suite</span>
            <span className="text-[10px] text-white bg-indigo-800 px-1.5 py-0.5 rounded">20cr</span>
          </button>
        </div>
      </div>

      {isGenerating && (
        <div className="min-h-[300px] border border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center p-8 text-center" id="generating_loader_box">
          <div className="relative mb-4">
            <div className="w-12 h-12 rounded-full border-2 border-indigo-600/20 border-t-indigo-500 animate-spin" />
            <Sparkles className="w-5 h-5 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <h5 className="text-sm font-bold text-slate-200">Gemini copywriting models actively compiling...</h5>
          <p className="text-xs text-slate-500 max-w-sm mt-1">
            Analyzing product metadata, objection angles, benefits lists and hooks to write flawless conversion content. No charge on failure.
          </p>
        </div>
      )}

      {/* VERSION HISTORY SELECTOR & EMPTY STATE GUARD */}
      {!isGenerating && !latestGeneration && (
        <div className="border border-slate-900 rounded-xl p-12 text-center flex flex-col items-center justify-center max-w-2xl mx-auto my-6" id="empty_content_studio_onboarding">
          <span className="w-12 h-12 rounded-full bg-slate-950 border border-slate-900 flex items-center justify-center text-xl mb-4 text-slate-400">
            🎨
          </span>
          <h4 className="text-base font-bold text-slate-200 mb-1.5">Your Creative Vault is Empty</h4>
          <p className="text-xs text-slate-400 leading-normal mb-6">
            You haven't generated any marketing copy, viral scripts, landing page formulas or welcome emails for <span className="text-slate-300 font-semibold">"{selectedProduct.title}"</span> yet. Spark copy generation above from only 5 credits.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => triggerCopyGeneration("package")}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs font-mono px-4 p-2.5 rounded-lg transition"
            >
              Generate Full Suite (20 cr)
            </button>
          </div>
        </div>
      )}

      {!isGenerating && latestGeneration && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="active_creative_vault">
          {/* LEFT RAIL - TAB NAVIGATION & REVISIONS PANEL */}
          <div className="lg:col-span-3 flex flex-col gap-5">
            {/* Version revision picker */}
            {historyList.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-300 font-bold mb-2">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Interactive Version History</span>
                </div>
                <div className="relative">
                  <select
                    value={selectedHistoryId}
                    onChange={(e) => handleHistorySelect(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-xs p-2 rounded outline-none text-slate-300 font-mono font-semibold cursor-pointer py-2 px-3-pr mb-1"
                    id="content_version_dropdown"
                  >
                    {historyList.map((hist) => (
                      <option key={hist.id} value={hist.id}>
                        V{hist.version} • {new Date(hist.createdAt).toLocaleDateString()} {hist.isLatest ? "(Latest)" : ""} [{hist.contentType}]
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-1 text-center">
                  Total saved revisions: {historyList.length}
                </div>
              </div>
            )}

            {/* Omnichannel Studio Navigators */}
            <div className="flex flex-col border border-slate-900 bg-slate-950 p-1.5 rounded-xl gap-1">
              <button
                onClick={() => setActiveTab("hooks")}
                className={`flex items-center gap-2.5 p-3 rounded-lg text-xs font-medium transition font-mono ${
                  activeTab === "hooks"
                    ? "bg-slate-900 text-indigo-400 border border-slate-800"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
                }`}
                id="internal_tab_hooks"
              >
                <span>🪝</span>
                <span className="flex-1 text-left">Scroll Hooks</span>
                {hooksList.length > 0 && (
                  <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded font-bold">{hooksList.length}</span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("scripts")}
                className={`flex items-center gap-2.5 p-3 rounded-lg text-xs font-medium transition font-mono ${
                  activeTab === "scripts"
                    ? "bg-slate-900 text-indigo-400 border border-slate-800"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
                }`}
                id="internal_tab_scripts"
              >
                <span>🎬</span>
                <span className="flex-1 text-left">Short Video Scripts</span>
                {scriptsList.length > 0 && (
                  <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded font-bold">{scriptsList.length}</span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("adCopy")}
                className={`flex items-center gap-2.5 p-3 rounded-lg text-xs font-medium transition font-mono ${
                  activeTab === "adCopy"
                    ? "bg-slate-900 text-indigo-400 border border-slate-800"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
                }`}
                disabled={adCopyList.length === 0}
                id="internal_tab_ad_copy"
              >
                <span>📢</span>
                <span className="flex-1 text-left">Paid Ad Copies</span>
                {adCopyList.length > 0 && (
                  <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded font-bold">{adCopyList.length}</span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("descriptions")}
                className={`flex items-center gap-2.5 p-3 rounded-lg text-xs font-medium transition font-mono ${
                  activeTab === "descriptions"
                    ? "bg-slate-900 text-indigo-400 border border-slate-800"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
                }`}
                disabled={!descriptions.short}
                id="internal_tab_descriptions"
              >
                <span>✍️</span>
                <span className="flex-1 text-left">Product Copy</span>
                {descriptions.short && (
                  <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded font-bold">3</span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("emails")}
                className={`flex items-center gap-2.5 p-3 rounded-lg text-xs font-medium transition font-mono ${
                  activeTab === "emails"
                    ? "bg-slate-900 text-indigo-400 border border-slate-800"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
                }`}
                disabled={emailsList.length === 0}
                id="internal_tab_emails"
              >
                <span>✉️</span>
                <span className="flex-1 text-left">Flow Automation</span>
                {emailsList.length > 0 && (
                  <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded font-bold">{emailsList.length}</span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("landingPage")}
                className={`flex items-center gap-2.5 p-3 rounded-lg text-xs font-medium transition font-mono ${
                  activeTab === "landingPage"
                    ? "bg-slate-900 text-indigo-400 border border-slate-800"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
                }`}
                disabled={!landingPage.headline}
                id="internal_tab_landing_page"
              >
                <span>📄</span>
                <span className="flex-1 text-left">Landing Page CRA</span>
                {landingPage.headline && (
                  <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded font-bold">1</span>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT VIEWPORT PANEL - VALUE RENDERING */}
          <div className="lg:col-span-9 bg-slate-900/20 border border-slate-900/50 rounded-xl p-6 min-h-[500px]" id="studio_viewport">
            
            {/* HOOKS RENDERING PANEL */}
            {activeTab === "hooks" && (
              <div id="studio_hooks_viewport">
                <div className="flex items-center justify-between pb-4 border-b border-slate-900 mb-6">
                  <div>
                    <h4 className="text-md font-bold font-sans text-slate-100 flex items-center gap-1.5">
                      <span>🪝</span> Scrolls-Hook Library
                    </h4>
                    <p className="text-xs text-slate-400">Viral attention magnets written from objections and pain point research.</p>
                  </div>
                  {hooksList.length > 0 && (
                    <button
                      onClick={() => {
                        const allH = hooksList.map((h: any) => `[${h.type.toUpperCase()}] ${h.content}`).join("\n");
                        handleCopy("all-hooks", allH);
                      }}
                      className="text-xs font-mono text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 p-1.5 px-3 bg-slate-900 border border-slate-800 rounded-md transition"
                      id="copy_all_hooks_btn"
                    >
                      {copiedId === "all-hooks" ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied All!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy All ({hooksList.length})</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {hooksList.length === 0 ? (
                  <div className="text-center py-16 text-slate-500 text-xs">
                    No Hooks present in this generation version load. Generate "Hooks" or "Full Suite" above.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {hooksList.map((h: any, i: number) => (
                      <div
                        key={i}
                        className="bg-slate-900 border border-slate-850 p-4 rounded-xl flex flex-col justify-between hover:border-indigo-900/40 transition group relative"
                        id={`hook_card_${i}`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-mono tracking-wider font-bold uppercase py-0.5 px-2 rounded bg-indigo-505/10 text-indigo-300 border border-indigo-950/40">
                              {h.type}
                            </span>
                            <span className="text-[10px] font-mono text-slate-550 group-hover:text-slate-400">#{i + 1}</span>
                          </div>
                          <p className="text-sm text-slate-200 leading-relaxed font-sans">{h.content}</p>
                        </div>

                        <div className="flex justify-end mt-4 pt-3 border-t border-slate-900/40">
                          <button
                            onClick={() => handleCopy(`hook-${i}`, h.content)}
                            className="p-1 px-2 hover:bg-slate-800 rounded text-slate-400 hover:text-white text-xs font-mono transition flex items-center gap-1"
                            id={`copy_hook_btn_${i}`}
                          >
                            {copiedId === `hook-${i}` ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400 text-[10px]">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span className="text-[10px]">Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* VIDEO SCRIPTS RENDERING PANEL */}
            {activeTab === "scripts" && (
              <div id="studio_scripts_viewport">
                <div className="pb-4 border-b border-slate-900 mb-6">
                  <h4 className="text-md font-bold font-sans text-slate-100 flex items-center gap-1.5">
                    <span>🎬</span> Playbook Video Scriptwriter
                  </h4>
                  <p className="text-xs text-slate-400">Omnichannel shortform scripts containing high-retention structured arcs.</p>
                </div>

                {scriptsList.length === 0 ? (
                  <div className="text-center py-16 text-slate-500 text-xs text-sans">
                    No video scripts loaded in this revision. Spawn content above to hydrate.
                  </div>
                ) : (
                  <div className="flex flex-col gap-6">
                    {scriptsList.map((script: any, index: number) => (
                      <div
                        key={index}
                        className="bg-slate-900/30 border border-slate-900 rounded-xl overflow-hidden hover:border-slate-800 transition"
                        id={`script_card_${index}`}
                      >
                        {/* Title header bar */}
                        <div className="bg-slate-900/70 px-4 py-3 border-b border-slate-900 flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="p-1 rounded bg-indigo-505/10 text-indigo-400 text-xs font-mono uppercase font-bold">
                              {script.type}
                            </span>
                            <span className="text-sm font-bold text-slate-100">{script.title || "Viral Storyboard"}</span>
                          </div>

                          <button
                            onClick={() => {
                              const sText = `SCRIPT: ${script.title}\n=======================\n[HOOK 0-3S]: ${script.hook}\n[PROBLEM]: ${script.problem}\n[SOLUTION]: ${script.solution}\n[BENEFITS]: ${script.benefits}\n[CTA]: ${script.cta}`;
                              handleCopy(`script-${index}`, sText);
                            }}
                            className="text-xs font-mono text-indigo-401 hover:text-indigo-300 flex items-center gap-1 px-2.5 py-1 rounded bg-slate-950 border border-slate-800/80 transition"
                            id={`copy_script_btn_${index}`}
                          >
                            {copiedId === `script-${index}` ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400 text-[10px]">Copied Script!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span className="text-[10px]">Copy Full Text</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Content parts - Hook, Problem, Solution, Benefits, CTA */}
                        <div className="p-5 grid grid-cols-1 md:grid-cols-5 gap-4">
                          <div className="border-l-2 border-indigo-600 bg-slate-900/20 p-2.5 rounded-r">
                            <span className="text-[9px] font-mono font-bold text-indigo-400 uppercase select-none block mb-1">🪝 Hook (0-3s)</span>
                            <p className="text-xs text-slate-300 leading-relaxed">{script.hook}</p>
                          </div>
                          
                          <div className="border-l-2 border-rose-500 bg-slate-900/20 p-2.5 rounded-r">
                            <span className="text-[9px] font-mono font-bold text-rose-400 uppercase select-none block mb-1">⚠️ Problem</span>
                            <p className="text-xs text-slate-300 leading-relaxed">{script.problem}</p>
                          </div>

                          <div className="border-l-2 border-emerald-500 bg-slate-900/20 p-2.5 rounded-r">
                            <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase select-none block mb-1">💡 Solution</span>
                            <p className="text-xs text-slate-300 leading-relaxed">{script.solution}</p>
                          </div>

                          <div className="border-l-2 border-teal-500 bg-slate-900/20 p-2.5 rounded-r">
                            <span className="text-[9px] font-mono font-bold text-teal-400 uppercase select-none block mb-1">✅ Benefits</span>
                            <p className="text-xs text-slate-300 leading-relaxed">{script.benefits}</p>
                          </div>

                          <div className="border-l-2 border-amber-500 bg-slate-900/20 p-2.5 rounded-r">
                            <span className="text-[9px] font-mono font-bold text-amber-500 uppercase select-none block mb-1">📢 Call To Action</span>
                            <p className="text-xs text-slate-300 leading-relaxed">{script.cta}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* AD COPY RENDERING PANEL */}
            {activeTab === "adCopy" && (
              <div id="studio_ad_copy_viewport">
                <div className="pb-4 border-b border-slate-900 mb-6">
                  <h4 className="text-md font-bold font-sans text-slate-100 flex items-center gap-1.5">
                    <span>📢</span> Direct Response Paid Copies
                  </h4>
                  <p className="text-xs text-slate-400">Pre-built multi-platform copy structures calibrated across short, medium & long lengths.</p>
                </div>

                {adCopyList.length === 0 ? (
                  <div className="text-center py-16 text-slate-500 text-xs text-mono">
                    Ad copies are only generated inside of the comprehensive "Full Suite" package. Pick "Generate Full Suite" to deploy.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {adCopyList.map((copy: any, i: number) => (
                      <div
                        key={i}
                        className="bg-slate-900 border border-slate-850 rounded-xl overflow-hidden flex flex-col justify-between"
                        id={`ad_copy_card_${i}`}
                      >
                        <div className="px-4 py-3.5 bg-slate-850/60 border-b border-slate-905 flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-200 capitalize">
                              {copy.platform}
                            </span>
                            <span className="text-[10px] font-mono font-bold uppercase rounded p-0.5 px-2 bg-indigo-505/10 text-indigo-400">
                              {copy.format}
                            </span>
                          </div>
                          
                          <button
                            onClick={() => handleCopy(`ad-${i}`, copy.text)}
                            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition"
                            id={`copy_ad_btn_${i}`}
                          >
                            {copiedId === `ad-${i}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <div className="p-4 flex-1">
                          <p className="text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-wrap">{copy.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* PRODUCT DESCRIPTIONS PANEL */}
            {activeTab === "descriptions" && (
              <div id="studio_descriptions_viewport">
                <div className="pb-4 border-b border-slate-900 mb-6">
                  <h4 className="text-md font-bold font-sans text-slate-100 flex items-center gap-1.5">
                    <span>✍️</span> Catalog Descriptions Generator
                  </h4>
                  <p className="text-xs text-slate-400">High-converting merchant listings optimized for search crawls and visual catalogs.</p>
                </div>

                {!descriptions.short ? (
                  <div className="text-center py-16 text-slate-500 text-xs text-mono">
                    Catalog copies are only generated inside of the "Full Suite" package. Use "Generate Full Suite" above.
                  </div>
                ) : (
                  <div className="flex flex-col gap-6">
                    {/* Short Description */}
                    <div className="bg-slate-900 border border-slate-850 rounded-xl p-5" id="desc_short_box">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-900 mb-3">
                        <span className="text-xs font-bold font-sans text-indigo-300 uppercase">Short Hook Description</span>
                        <button
                          onClick={() => handleCopy("desc-short", descriptions.short)}
                          className="text-xs text-indigo-400 hover:text-white flex items-center gap-1 font-mono"
                        >
                          {copiedId === "desc-short" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedId === "desc-short" ? "Copied" : "Copy"}</span>
                        </button>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed font-sans">{descriptions.short}</p>
                    </div>

                    {/* Long Description */}
                    <div className="bg-slate-900 border border-slate-850 rounded-xl p-5" id="desc_long_box">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-900 mb-3">
                        <span className="text-xs font-bold font-sans text-rose-300 uppercase">Long Bulleted Listing</span>
                        <button
                          onClick={() => handleCopy("desc-long", descriptions.long)}
                          className="text-xs text-indigo-400 hover:text-white flex items-center gap-1 font-mono"
                        >
                          {copiedId === "desc-long" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedId === "desc-long" ? "Copied" : "Copy"}</span>
                        </button>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-wrap">{descriptions.long}</p>
                    </div>

                    {/* SEO Meta Description */}
                    <div className="bg-slate-900 border border-slate-850 rounded-xl p-5" id="desc_seo_box">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-900 mb-3">
                        <span className="text-xs font-bold font-sans text-emerald-300 uppercase">SEO Crowlers & Metadata Tags</span>
                        <button
                          onClick={() => handleCopy("desc-seo", descriptions.seo)}
                          className="text-xs text-indigo-400 hover:text-white flex items-center gap-1 font-mono"
                        >
                          {copiedId === "desc-seo" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedId === "desc-seo" ? "Copied" : "Copy"}</span>
                        </button>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed font-sans font-mono bg-slate-950 p-3 rounded">{descriptions.seo}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* EMAIL MARKETING PANEL */}
            {activeTab === "emails" && (
              <div id="studio_emails_viewport">
                <div className="pb-4 border-b border-slate-900 mb-6">
                  <h4 className="text-md font-bold font-sans text-slate-100 flex items-center gap-1.5">
                    <span>✉️</span> Klaviyo Automation Flows
                  </h4>
                  <p className="text-xs text-slate-400">Marketing email flows engineered across welcome sequences, promotional blasts and abandonment checkout recovery.</p>
                </div>

                {emailsList.length === 0 ? (
                  <div className="text-center py-16 text-slate-500 text-xs text-sans">
                    Flow sequences requires the omnichannel "Full Suite" generation package.
                  </div>
                ) : (
                  <div className="flex flex-col gap-8">
                    {emailsList.map((email: any, index: number) => (
                      <div
                        key={index}
                        className="bg-slate-905 border border-slate-900 rounded-xl overflow-hidden"
                        id={`email_card_${index}`}
                      >
                        <div className="bg-slate-900 px-4 py-3 border-b border-slate-900 flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-bold uppercase rounded p-0.5 px-2 bg-indigo-505/10 text-indigo-400 border border-indigo-950/20">
                              {email.type}
                            </span>
                            <span className="text-xs font-medium text-slate-400">Email Campaign flow</span>
                          </div>

                          <button
                            onClick={() => {
                              const eCopy = `SUBJECT: ${email.subject}\n=== BODY ===\n${email.body}`;
                              handleCopy(`email-${index}`, eCopy);
                            }}
                            className="text-xs font-mono text-indigo-410 hover:text-indigo-300 flex items-center gap-1 px-2.5 py-1 rounded bg-slate-950 border border-slate-800 transition"
                            id={`copy_email_btn_${index}`}
                          >
                            {copiedId === `email-${index}` ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400 text-[10px]">Copied Message!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span className="text-[10px]">Copy Copywrite</span>
                              </>
                            )}
                          </button>
                        </div>
                        
                        <div className="p-5 font-sans">
                          <div className="mb-4 flex items-baseline gap-2 bg-slate-900/40 p-2.5 rounded-lg border border-slate-900">
                            <span className="text-xs font-mono font-bold text-slate-400 uppercase shrink-0">Subject:</span>
                            <span className="text-xs text-slate-100 font-bold">{email.subject}</span>
                          </div>

                          <div className="bg-slate-950/80 border border-slate-900 p-4 rounded-lg whitespace-pre-wrap text-slate-300 text-xs leading-relaxed max-h-[300px] overflow-y-auto">
                            {email.body}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* LANDING PAGE SKELETON */}
            {activeTab === "landingPage" && (
              <div id="studio_landing_page_viewport">
                <div className="pb-4 border-b border-slate-900 mb-6 font-sans">
                  <h4 className="text-md font-bold text-slate-100 flex items-center gap-1.5">
                    <span>📄</span> High-Converting Landing Page Layout
                  </h4>
                  <p className="text-xs text-slate-400">Highly customized CRO wireframe formulas featuring compelling display headings, feature benefits, answers to core customer friction issues, and a rich 5-item structured FAQ.</p>
                </div>

                {!landingPage.headline ? (
                  <div className="text-center py-16 text-slate-500 text-xs text-mono">
                    Landing page wireframes are assembled through our "Full Suite" generation package.
                  </div>
                ) : (
                  <div className="flex flex-col gap-6 font-sans" id="landing_page_schema_wrapper">
                    {/* Copier header */}
                    <div className="flex justify-end">
                      <button
                        onClick={() => {
                          const fCopy = `LANDING PAGE SCHEMATICS\n============================\nHEADLINE: ${landingPage.headline}\nSUBHEADLINE: ${landingPage.subheadline}\nBENEFITS:\n${landingPage.benefits?.map((b: string) => `- ${b}`).join("\n")}\nFEATURES:\n${landingPage.features?.map((f: any) => `- ${f.name}: ${f.description}`).join("\n")}\nREFUTATIONS:\n${landingPage.objections?.map((o: any) => `- Objection: ${o.objection}\n  Refutation Angle: ${o.answer}`).join("\n")}\nFAQs:\n${landingPage.faq?.map((faq: any) => `- Q: ${faq.question}\n  A: ${faq.answer}`).join("\n")}\nCALL TO ACTION: ${landingPage.cta}`;
                          handleCopy("landing-page-all", fCopy);
                        }}
                        className="text-xs font-mono font-bold text-slate-200 bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg flex items-center gap-1.5 transition"
                        id="copy_all_landing_page_btn"
                      >
                        {copiedId === "landing-page-all" ? (
                          <>
                            <Check className="w-4 h-4 text-white" />
                            <span>Copied Wireframe!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 text-white" />
                            <span>Copy Wireframe Layout</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Headline and Subheadline Hero block */}
                    <div className="bg-slate-900 border border-slate-850 p-5 rounded-xl border-t-2 border-t-indigo-600">
                      <span className="text-[10px] font-mono text-indigo-400 font-bold block uppercase mb-1">Hero Section</span>
                      <h4 className="text-lg font-extrabold text-slate-100 tracking-tight leading-normal mb-1">{landingPage.headline}</h4>
                      <p className="text-xs text-slate-400 leading-normal">{landingPage.subheadline}</p>
                    </div>

                    {/* Side-by-side Benefits & Features */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-slate-900 border border-slate-850 p-5 rounded-xl">
                        <span className="text-[10px] font-mono text-emerald-400 font-bold block uppercase mb-3">Copywriter Benefits</span>
                        <ul className="flex flex-col gap-2">
                          {landingPage.benefits?.map((benefit: string, bidx: number) => (
                            <li key={bidx} className="text-xs text-slate-300 leading-relaxed flex items-start gap-2">
                              <span className="text-emerald-400 select-none">✓</span>
                              <span>{benefit}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="bg-slate-900 border border-slate-850 p-5 rounded-xl">
                        <span className="text-[10px] font-mono text-indigo-400 font-bold block uppercase mb-3">Core Functional Features</span>
                        <div className="flex flex-col gap-3">
                          {landingPage.features?.map((f: any, fidx: number) => (
                            <div key={fidx} id={`lp_feature_${fidx}`}>
                              <h5 className="text-xs font-bold text-slate-100 mb-0.5">{f.name}</h5>
                              <p className="text-[11px] text-slate-400 leading-normal">{f.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Friction Solver / Objection Countering */}
                    <div className="bg-slate-900 border border-slate-850 p-5 rounded-xl">
                      <span className="text-[10px] font-mono text-rose-400 font-bold block uppercase mb-3">CRO Objection Refutations</span>
                      <div className="flex flex-col gap-4">
                        {landingPage.objections?.map((obj: any, oidx: number) => (
                          <div key={oidx} className="bg-slate-950 p-3 rounded border border-slate-900/60" id={`lp_objection_${oidx}`}>
                            <p className="text-xs font-bold text-rose-300 mb-1">“{obj.objection}”</p>
                            <p className="text-[11px] text-slate-400 leading-normal leading-relaxed">{obj.answer}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 5-item FAQ list */}
                    <div className="bg-slate-900 border border-slate-850 p-5 rounded-xl">
                      <span className="text-[10px] font-mono text-amber-500 font-bold block uppercase mb-3">Customer FAQ Section</span>
                      <div className="flex flex-col gap-4">
                        {landingPage.faq?.map((faq: any, fqidx: number) => (
                          <div key={fqidx} className="pb-3 border-b border-slate-900 last:border-0 last:pb-0" id={`lp_faq_${fqidx}`}>
                            <h5 className="text-xs font-bold text-slate-200 mb-1">Q: {faq.question}</h5>
                            <p className="text-xs text-slate-400 leading-relaxed">A: {faq.answer}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* CTA section */}
                    <div className="bg-slate-900 border border-slate-850 p-5 rounded-xl text-center">
                      <span className="text-[100px] font-bold text-indigo-400 leading-none hidden">★</span>
                      <span className="text-[10px] font-mono text-indigo-400 font-bold block uppercase mb-1">Conversion Driver Call To Action</span>
                      <p className="text-sm font-bold text-slate-200 mb-4">“{landingPage.cta}”</p>
                      <button
                        onClick={() => handleCopy("lp-cta", landingPage.cta)}
                        className="bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-900 text-xs font-mono font-bold px-4 p-2 rounded transition"
                      >
                        Copy Offer Headline Text
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
