import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  TrendingUp,
  Coins,
  RefreshCw,
  AlertCircle,
  Globe,
  Flame,
  HelpCircle,
  Tv,
  Clock,
  ExternalLink,
  ChevronRight,
  BookOpen,
  Cpu,
  Layers,
  History,
  CheckCircle2,
  Copy,
  Check
} from "lucide-react";
import {
  NormalizedProduct,
  ProductAnalysis,
  CreditLedgerEntry,
  AdvancedAnalyticsPayload,
  AnalyticsDatePreset,
  createEmptyBrandIntelligence,
} from "../types.ts";
import AnalyticsCenter from "./analytics/AnalyticsCenter.tsx";

interface IntelligenceDashboardProps {
  selectedProduct: NormalizedProduct | null;
  workspaceId: string;
  userCredits: number;
  onAnalysisSuccess: () => void;
  initialTab?: "analytics" | "scores" | "market" | "marketing" | "brand" | "creative" | "history";
}

export default function IntelligenceDashboard({
  selectedProduct,
  workspaceId,
  userCredits,
  onAnalysisSuccess,
  initialTab = "analytics",
}: IntelligenceDashboardProps) {
  const [analysisData, setAnalysisData] = useState<ProductAnalysis | null>(null);
  const [history, setHistory] = useState<ProductAnalysis[]>([]);
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([]);
  const [analyticsData, setAnalyticsData] = useState<AdvancedAnalyticsPayload | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [targetLang, setTargetLang] = useState<string>("en");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"analytics" | "scores" | "market" | "marketing" | "brand" | "creative" | "history">(initialTab);
  const [activeHistoryAnalysis, setActiveHistoryAnalysis] = useState<ProductAnalysis | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [analyticsPreset, setAnalyticsPreset] = useState<AnalyticsDatePreset>("30d");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 1500);
  };

  // Sync latest analysis and history when selectedProduct changes
  const fetchAnalysisInfo = async () => {
    if (!selectedProduct?.id) {
      setAnalysisData(null);
      setHistory([]);
      return;
    }

    try {
      setErrorText(null);
      const res = await fetch(`/api/intelligence/analysis?productId=${selectedProduct.id}`);
      if (res.ok) {
        const data = await res.json();
        setAnalysisData(data.latest);
        setHistory(data.history || []);
        setActiveHistoryAnalysis(null); // Reset detail override when changing product
      }
    } catch (err) {
      console.error("Error fetching product intelligence data:", err);
    }
  };

  // Sync credit ledger
  const fetchLedger = async () => {
    try {
      const res = await fetch(`/api/intelligence/ledger?workspaceId=${workspaceId}`);
      if (res.ok) {
        setLedger(await res.json());
      }
    } catch (err) {
      console.error("Error fetching credit ledger:", err);
    }
  };

  const fetchAnalytics = async () => {
    if (!selectedProduct?.id) {
      setAnalyticsData(null);
      return;
    }

    if (analyticsPreset === "custom" && (!customStartDate || !customEndDate)) {
      setAnalyticsData(null);
      return;
    }

    try {
      setAnalyticsLoading(true);
      const params = new URLSearchParams({
        workspaceId,
        productId: selectedProduct.id,
        preset: analyticsPreset,
      });

      if (analyticsPreset === "custom") {
        params.set("startDate", customStartDate);
        params.set("endDate", customEndDate);
      }

      const res = await fetch(`/api/intelligence/analytics?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to fetch advanced analytics.");
      }
      setAnalyticsData(await res.json());
    } catch (err) {
      console.error("Error fetching advanced analytics:", err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysisInfo();
    fetchLedger();
  }, [selectedProduct, workspaceId]);

  useEffect(() => {
    setActiveTab(initialTab);
    setActiveHistoryAnalysis(null);
  }, [initialTab, selectedProduct?.id]);

  useEffect(() => {
    fetchAnalytics();
  }, [selectedProduct, workspaceId, analyticsPreset, customStartDate, customEndDate]);

  const handleRunAnalysis = async () => {
    if (!selectedProduct?.id) return;

    if (userCredits < 20) {
      setErrorText("Insufficient credits. Running an analysis costs exactly 20 credits.");
      return;
    }

    setLoading(true);
    setErrorText(null);

    try {
      const res = await fetch("/api/intelligence/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProduct.id,
          languageCode: targetLang,
          workspaceId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to parse product catalog intelligence.");
      }

      setAnalysisData(data.analysis);
      fetchAnalysisInfo(); // Refresh version list
      fetchLedger();       // Refresh credit ledger
      fetchAnalytics();    // Refresh analytics center
      onAnalysisSuccess(); // Signal parent to update user stats
    } catch (err: any) {
      setErrorText(err.message || "An expected error occurred during intelligence synthesis.");
    } finally {
      setLoading(false);
    }
  };

  if (!selectedProduct) {
    return (
      <div className="bg-slate-950/60 border border-slate-800 p-8 rounded-xl text-center flex flex-col items-center justify-center min-h-[350px]">
        <div className="p-4 rounded-full bg-slate-900 border border-slate-800 mb-4 text-indigo-400">
          <Cpu className="w-8 h-8 animate-pulse" />
        </div>
        <h3 className="text-md font-bold text-slate-200">No Product Selected</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-2 leading-relaxed">
          Select or import an active product listing from the inventory panel to unlock the full mathematical marketplace intelligence reports.
        </p>
      </div>
    );
  }

  // Determine active view record (either historic version override, or latest analysis)
  const currentAnalysis = activeHistoryAnalysis || analysisData;
  const currentBrandIntelligence = currentAnalysis?.brandIntelligence
    ?? createEmptyBrandIntelligence(selectedProduct.vendor || selectedProduct.title);

  return (
    <div className="bg-slate-950/60 border border-slate-800 p-6 rounded-xl flex flex-col gap-6 shadow-2xl">
      
      {/* Product Selection Card Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-900 pb-4 gap-4">
        <div>
          <span className="text-xs font-mono text-indigo-400 block mb-1">PROFILING INTELLIGENCE</span>
          <h2 className="text-xl font-bold text-white flex items-center gap-2 max-w-md truncate">
            {selectedProduct.title}
          </h2>
          <span className="text-[10px] text-slate-500 font-mono">
            Vendor: {selectedProduct.vendor} | Base Price: {selectedProduct.currency} {selectedProduct.price}
          </span>
        </div>

        {/* Localized Language Selecting Core and Action button */}
        <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0 select-none">
          <div className="flex items-center gap-1.5 bg-slate-900/60 border border-slate-800 rounded-lg p-1">
            <Globe className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="bg-transparent text-xs text-slate-300 font-mono focus:outline-none pr-2 py-0.5"
            >
              <option value="en">English (US)</option>
              <option value="es">Español (ES)</option>
              <option value="fr">Français (FR)</option>
              <option value="de">Deutsch (DE)</option>
              <option value="ar">العربية (AR)</option>
              <option value="ja">日本語 (JA)</option>
            </select>
          </div>

          <button
            onClick={handleRunAnalysis}
            disabled={loading}
            className="flex-1 md:flex-initial bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-850 disabled:text-indigo-400 text-white font-semibold text-xs px-3.5 py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Analyze (20 Credits)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {errorText && (
        <div className="bg-rose-950/40 border border-rose-500/30 p-3 rounded-lg text-rose-300 text-xs flex items-start gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorText}</span>
        </div>
      )}

      {/* Main Tabs Selection Row */}
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-1 overflow-x-auto pb-1.5 border-b border-slate-905 select-none no-scrollbar">
          <button
            onClick={() => { setActiveTab("analytics"); setActiveHistoryAnalysis(null); }}
            className={`px-3 py-1.5 text-xs font-mono rounded-md transition shrink-0 ${
              activeTab === "analytics"
                ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Analytics center
          </button>
          <button
            onClick={() => { setActiveTab("scores"); setActiveHistoryAnalysis(null); }}
            className={`px-3 py-1.5 text-xs font-mono rounded-md transition shrink-0 ${
              activeTab === "scores"
                ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Opportunity scores
          </button>
          <button
            onClick={() => { setActiveTab("market"); }}
            className={`px-3 py-1.5 text-xs font-mono rounded-md transition shrink-0 ${
              activeTab === "market"
                ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Market intelligence
          </button>
          <button
            onClick={() => { setActiveTab("marketing"); }}
            className={`px-3 py-1.5 text-xs font-mono rounded-md transition shrink-0 ${
              activeTab === "marketing"
                ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Marketing intelligence
          </button>
          <button
            onClick={() => { setActiveTab("brand"); }}
            className={`px-3 py-1.5 text-xs font-mono rounded-md transition shrink-0 ${
              activeTab === "brand"
                ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Brand intelligence
          </button>
          <button
            onClick={() => { setActiveTab("creative"); }}
            className={`px-3 py-1.5 text-xs font-mono rounded-md transition shrink-0 ${
              activeTab === "creative"
                ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Creative ideas
          </button>
          <button
            onClick={() => { setActiveTab("history"); }}
            className={`px-3 py-1.5 text-xs font-mono rounded-md transition shrink-0 flex items-center gap-1 ${
              activeTab === "history"
                ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <History className="w-3 h-3" /> Versions ({history.length})
          </button>
        </div>

        {activeTab === "analytics" ? (
          <AnalyticsCenter
            analyticsData={analyticsData}
            loading={analyticsLoading}
            selectedProduct={selectedProduct}
            preset={analyticsPreset}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
            onPresetChange={setAnalyticsPreset}
            onCustomStartDateChange={setCustomStartDate}
            onCustomEndDateChange={setCustomEndDate}
          />
        ) : currentAnalysis ? (
        <div className="flex flex-col gap-5">
          <div className="min-h-[220px]">
            <AnimatePresence mode="wait">
              {activeTab === "scores" && (
                <motion.div
                  key="scores"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-1 md:grid-cols-12 gap-6"
                >
                  {/* Circular Overall Visual indicator */}
                  <div className="md:col-span-5 bg-slate-900/40 border border-slate-800 p-5 rounded-xl flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase mb-3">OVERALL INDEX</span>
                    <div className="relative w-36 h-36 flex items-center justify-center">
                      {/* SVG Circle Gauge */}
                      <svg className="w-full h-full transform -rotate-90">
                        <circle
                          cx="72"
                          cy="72"
                          r="60"
                          strokeWidth="10"
                          stroke="rgb(15, 23, 42)"
                          fill="transparent"
                        />
                        <circle
                          cx="72"
                          cy="72"
                          r="60"
                          strokeWidth="10"
                          stroke="rgb(99, 102, 241)"
                          fill="transparent"
                          strokeDasharray={376.8} // 2 * pi * r
                          strokeDashoffset={376.8 - (376.8 * currentAnalysis.opportunityScores.overall) / 100}
                          strokeLinecap="round"
                          className="transition-all duration-1000 ease-out"
                        />
                      </svg>
                      <div className="absolute text-center flex flex-col justify-center">
                        <span className="text-4xl font-extrabold text-white font-mono leading-none">
                          {currentAnalysis.opportunityScores.overall}
                        </span>
                        <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider mt-1.5 font-mono">
                          OPPORTUNITY
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[11px] font-mono text-slate-400">
                        Confidence score: <strong className="text-slate-200">{currentAnalysis.confidenceScore}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Sub-scores sliders block */}
                  <div className="md:col-span-7 flex flex-col justify-between bg-slate-900/20 p-5 border border-slate-800 rounded-xl gap-4">
                    <h4 className="text-xs font-mono uppercase tracking-widest text-slate-400 border-b border-slate-900 pb-2">Sub-Score Breakdowns (100 Max)</h4>
                    
                    <div className="flex flex-col gap-3 font-mono text-xs">
                      {/* Demand Score */}
                      <div>
                        <div className="flex justify-between mb-1 text-[11px]">
                          <span className="text-slate-300 flex items-center gap-1">🛒 Demand Score</span>
                          <span className="text-indigo-400 font-bold">{currentAnalysis.opportunityScores.demand}</span>
                        </div>
                        <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${currentAnalysis.opportunityScores.demand}%` }} />
                        </div>
                      </div>

                      {/* Competition */}
                      <div>
                        <div className="flex justify-between mb-1 text-[11px]">
                          <span className="text-slate-300 flex items-center gap-1">🤺 Competition Score</span>
                          <span className="text-indigo-400 font-bold">{currentAnalysis.opportunityScores.competition}</span>
                        </div>
                        <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${currentAnalysis.opportunityScores.competition}%` }} />
                        </div>
                      </div>

                      {/* Trend */}
                      <div>
                        <div className="flex justify-between mb-1 text-[11px]">
                          <span className="text-slate-300 flex items-center gap-1">📈 Trend Score</span>
                          <span className="text-indigo-400 font-bold">{currentAnalysis.opportunityScores.trend}</span>
                        </div>
                        <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${currentAnalysis.opportunityScores.trend}%` }} />
                        </div>
                      </div>

                      {/* Profitability */}
                      <div>
                        <div className="flex justify-between mb-1 text-[11px]">
                          <span className="text-slate-300 flex items-center gap-1">💲 Profitability Score</span>
                          <span className="text-indigo-400 font-bold">{currentAnalysis.opportunityScores.profitability}</span>
                        </div>
                        <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${currentAnalysis.opportunityScores.profitability}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === "market" && (
                <motion.div
                  key="market"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col gap-5 text-slate-200"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Destination country & pricing options */}
                    <div className="bg-slate-905 p-4 border border-slate-800 rounded-xl flex flex-col gap-3 font-mono text-xs">
                      <div className="flex items-center gap-2 text-indigo-400 border-b border-slate-900 pb-2">
                        <Globe className="w-4 h-4" />
                        <span className="font-bold uppercase tracking-wider">Localized targets</span>
                      </div>
                      <div className="flex justify-between p-2 rounded bg-slate-950/40">
                        <span className="text-slate-400">Target countries</span>
                        <span className="text-white font-bold">{currentAnalysis.marketIntelligence.bestCountries.join(" / ")}</span>
                      </div>
                      <div className="flex justify-between p-2 rounded bg-slate-950/40">
                        <span className="text-slate-400">Suggested selling price</span>
                        <span className="text-white font-bold">
                          {currentAnalysis.marketIntelligence.suggestedPricing.currency} {currentAnalysis.marketIntelligence.suggestedPricing.msrp}
                        </span>
                      </div>
                      <div className="flex justify-between p-2 rounded bg-slate-950/40 text-[11px]">
                        <span className="text-slate-500">Floor/Premium elastic bounds</span>
                        <span className="text-indigo-300">
                          {currentAnalysis.marketIntelligence.suggestedPricing.lowestAestheticBound} - {currentAnalysis.marketIntelligence.suggestedPricing.premiumVibeBound}
                        </span>
                      </div>
                    </div>

                    {/* Best Ad networks */}
                    <div className="bg-slate-905 p-4 border border-slate-800 rounded-xl flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-indigo-400 border-b border-slate-900 pb-2 font-mono text-xs">
                        <Tv className="w-4 h-4" />
                        <span className="font-bold uppercase tracking-wider">Top ad platform alignment</span>
                      </div>
                      <div className="flex flex-col gap-2 overflow-y-auto max-h-[140px] pr-1">
                        {currentAnalysis.marketIntelligence.bestAdPlatforms.map((plat) => (
                          <div key={plat.platform} className="bg-slate-950/30 p-2.5 rounded border border-slate-900 flex flex-col gap-1">
                            <div className="flex items-center justify-between font-mono text-xs">
                              <span className="font-bold text-slate-100 capitalize">{plat.platform}</span>
                              <span className="bg-indigo-500/10 text-indigo-300 text-[9px] px-2 py-0.5 rounded border border-indigo-500/20">{plat.format}</span>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-normal">{plat.justification}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Best Audiences personas */}
                  <div className="bg-slate-905 p-4 border border-slate-800 rounded-xl flex flex-col gap-2.5">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-indigo-400 border-b border-slate-900 pb-2">Primary ideal target audiences</h4>
                    <div className="flex flex-col gap-3">
                      {currentAnalysis.marketIntelligence.bestAudiences.map((aud) => (
                        <div key={aud.personaName} className="p-3 bg-slate-950/20 rounded border border-slate-900/60 leading-normal flex items-start gap-3">
                          <div className="p-2 rounded bg-indigo-500/10 text-indigo-400 shrink-0 mt-0.5">
                            <Flame className="w-4.5 h-4.5" />
                          </div>
                          <div>
                            <strong className="text-xs text-slate-200 block font-sans mb-1">{aud.personaName}</strong>
                            <p className="text-xs text-slate-400">{aud.rationale}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === "marketing" && (
                <motion.div
                  key="marketing"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-6 text-slate-200"
                >
                  {/* Left: Pain points & Selling points */}
                  <div className="flex flex-col gap-4">
                    <div className="bg-slate-905 p-4 border border-slate-800 rounded-xl flex flex-col gap-2.5">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-indigo-400 border-b border-slate-900 pb-1.5">Key customer pain points</h4>
                      <ul className="flex flex-col gap-2 text-xs text-slate-400 leading-normal">
                        {currentAnalysis.marketingIntelligence.painPoints.map((p, idx) => (
                          <li key={idx} className="flex gap-2 items-start">
                            <span className="text-indigo-400 font-mono font-bold">0{idx + 1}.</span>
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-slate-905 p-4 border border-slate-800 rounded-xl flex flex-col gap-2.5">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-indigo-400 border-b border-slate-900 pb-1.5">Strategic selling & brand angles</h4>
                      <ul className="flex flex-col gap-2 text-xs text-slate-400 leading-normal">
                        {currentAnalysis.marketingIntelligence.sellingAngles.map((sa, idx) => (
                          <li key={idx} className="flex gap-2 items-start bg-indigo-500/5 p-2 rounded border border-indigo-500/10">
                            <ChevronRight className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                            <span className="text-indigo-200 italic">"{sa}"</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Right: Objections refutations */}
                  <div className="bg-slate-905 p-4 border border-slate-800 rounded-xl flex flex-col gap-3">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-indigo-400 border-b border-slate-900 pb-1.5">Blocking objections & rebuttals</h4>
                    <div className="flex flex-col gap-3 overflow-y-auto max-h-[300px] pr-1">
                      {currentAnalysis.marketingIntelligence.objections.map((obj, idx) => (
                        <div key={idx} className="p-3 bg-slate-950/40 rounded border border-slate-900 leading-normal">
                          <span className="text-[10px] font-mono text-slate-500 block uppercase mb-1">OBJECTION:</span>
                          <p className="text-xs text-slate-300 font-medium mb-2">"{obj.objection}"</p>
                          <span className="text-[10px] font-mono text-indigo-400 block uppercase mb-1">REFUTATION ANGLE:</span>
                          <p className="text-xs text-slate-400 italic bg-indent p-2 rounded bg-slate-950 border border-slate-900 text-slate-300">"{obj.refutationAngle}"</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === "brand" && (
                <motion.div
                  key="brand"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col gap-5 text-slate-200"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-905 p-4 border border-slate-800 rounded-xl flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-indigo-400 border-b border-slate-900 pb-2 font-mono text-xs">
                        <Layers className="w-4 h-4" />
                        <span className="font-bold uppercase tracking-wider">Brand voice analyzer</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2 text-xs">
                        <div className="bg-slate-950/40 rounded-lg border border-slate-900 p-3">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Archetype</span>
                          <p className="text-slate-100 mt-1 font-semibold">{currentBrandIntelligence.brandVoiceAnalyzer.archetype || "Not enough signal yet"}</p>
                        </div>
                        <div className="bg-slate-950/40 rounded-lg border border-slate-900 p-3">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Essence</span>
                          <p className="text-slate-300 mt-1 leading-relaxed">{currentBrandIntelligence.brandVoiceAnalyzer.essence || "Run a fresh analysis to generate a stronger brand essence."}</p>
                        </div>
                        <div className="bg-slate-950/40 rounded-lg border border-slate-900 p-3">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Messaging pillars</span>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {currentBrandIntelligence.brandVoiceAnalyzer.messagingPillars.length > 0 ? currentBrandIntelligence.brandVoiceAnalyzer.messagingPillars.map((pillar, idx) => (
                              <span key={idx} className="px-2 py-1 rounded border border-indigo-500/20 bg-indigo-500/10 text-indigo-200 text-[11px]">
                                {pillar}
                              </span>
                            )) : (
                              <span className="text-slate-500 text-xs">No messaging pillars generated yet.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-905 p-4 border border-slate-800 rounded-xl flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-indigo-400 border-b border-slate-900 pb-2 font-mono text-xs">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="font-bold uppercase tracking-wider">Tone of voice analysis</span>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        <div className="bg-slate-950/40 rounded-lg border border-slate-900 p-3">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Primary tone</span>
                          <p className="text-slate-100 mt-1 font-semibold">{currentBrandIntelligence.toneOfVoiceAnalysis.primaryTone || "Awaiting analysis"}</p>
                          {currentBrandIntelligence.toneOfVoiceAnalysis.secondaryTones.length > 0 && (
                            <p className="text-slate-400 mt-1 text-xs">
                              Secondary: {currentBrandIntelligence.toneOfVoiceAnalysis.secondaryTones.join(" / ")}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          {currentBrandIntelligence.toneOfVoiceAnalysis.tonalSliders.length > 0 ? currentBrandIntelligence.toneOfVoiceAnalysis.tonalSliders.map((slider) => (
                            <div key={slider.dimension} className="bg-slate-950/30 rounded-lg border border-slate-900 p-3">
                              <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                                <span className="text-slate-300 uppercase">{slider.dimension.replace(/_/g, " ")}</span>
                                <span className="text-indigo-300 font-bold">{slider.score}</span>
                              </div>
                              <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${slider.score}%` }} />
                              </div>
                              <p className="text-slate-400 text-xs mt-2">{slider.guidance}</p>
                            </div>
                          )) : (
                            <div className="bg-slate-950/30 rounded-lg border border-slate-900 p-3 text-slate-500 text-xs">
                              Tone sliders will appear after the next successful intelligence run.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-905 p-4 border border-slate-800 rounded-xl flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-indigo-400 border-b border-slate-900 pb-2 font-mono text-xs">
                        <TrendingUp className="w-4 h-4" />
                        <span className="font-bold uppercase tracking-wider">Brand positioning</span>
                      </div>
                      <div className="space-y-3 text-xs">
                        <div className="bg-slate-950/30 rounded-lg border border-slate-900 p-3">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Value proposition</span>
                          <p className="text-slate-200 mt-1 leading-relaxed">{currentBrandIntelligence.brandPositioning.valueProposition || "No value proposition generated yet."}</p>
                        </div>
                        <div className="bg-slate-950/30 rounded-lg border border-slate-900 p-3">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Brand promise</span>
                          <p className="text-slate-300 mt-1 leading-relaxed">{currentBrandIntelligence.brandPositioning.brandPromise || "No brand promise generated yet."}</p>
                        </div>
                        <div className="bg-slate-950/30 rounded-lg border border-slate-900 p-3">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Elevator pitch</span>
                          <p className="text-slate-300 mt-1 leading-relaxed">{currentBrandIntelligence.brandPositioning.elevatorPitch || "No elevator pitch generated yet."}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-905 p-4 border border-slate-800 rounded-xl flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-indigo-400 border-b border-slate-900 pb-2 font-mono text-xs">
                        <Sparkles className="w-4 h-4" />
                        <span className="font-bold uppercase tracking-wider">Brand identity generator</span>
                      </div>
                      <div className="grid grid-cols-1 gap-3 text-xs">
                        <div className="bg-slate-950/30 rounded-lg border border-slate-900 p-3">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Brand name</span>
                          <p className="text-slate-100 mt-1 font-semibold">{currentBrandIntelligence.brandIdentityGenerator.brandName || selectedProduct.vendor || selectedProduct.title}</p>
                          <p className="text-indigo-200 mt-1 italic">{currentBrandIntelligence.brandIdentityGenerator.tagline || "No tagline generated yet."}</p>
                        </div>
                        <div className="bg-slate-950/30 rounded-lg border border-slate-900 p-3">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Mission & vision</span>
                          <p className="text-slate-300 mt-1 leading-relaxed">{currentBrandIntelligence.brandIdentityGenerator.mission || "Mission pending."}</p>
                          <p className="text-slate-400 mt-2 leading-relaxed">{currentBrandIntelligence.brandIdentityGenerator.vision || "Vision pending."}</p>
                        </div>
                        <div className="bg-slate-950/30 rounded-lg border border-slate-900 p-3">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Visual direction</span>
                          <p className="text-slate-300 mt-1 leading-relaxed">
                            {currentBrandIntelligence.brandIdentityGenerator.visualDirection.join(" / ") || "No visual direction generated yet."}
                          </p>
                          <p className="text-slate-400 mt-2">
                            Typography: {currentBrandIntelligence.brandIdentityGenerator.typographyStyle || "N/A"}
                          </p>
                          <p className="text-slate-400 mt-1">
                            Imagery: {currentBrandIntelligence.brandIdentityGenerator.imageryDirection || "N/A"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-905 p-4 border border-slate-800 rounded-xl flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-indigo-400 border-b border-slate-900 pb-2 font-mono text-xs">
                        <Globe className="w-4 h-4" />
                        <span className="font-bold uppercase tracking-wider">Competitor brand analysis</span>
                      </div>
                      <div className="flex flex-col gap-3 max-h-[320px] overflow-y-auto pr-1">
                        {currentBrandIntelligence.competitorBrandAnalysis.length > 0 ? currentBrandIntelligence.competitorBrandAnalysis.map((competitor) => (
                          <div key={competitor.competitorName} className="bg-slate-950/30 rounded-lg border border-slate-900 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <strong className="text-slate-100 text-xs">{competitor.competitorName}</strong>
                              <span className="text-[10px] font-mono text-indigo-300 uppercase">{competitor.toneOfVoice || "Tone pending"}</span>
                            </div>
                            <p className="text-slate-300 text-xs mt-2">{competitor.positioning}</p>
                            <p className="text-slate-500 text-[11px] mt-1">Audience: {competitor.audience || "N/A"}</p>
                            <p className="text-emerald-300 text-[11px] mt-2">Strengths: {competitor.strengths.join(" / ") || "N/A"}</p>
                            <p className="text-rose-300 text-[11px] mt-1">Weaknesses: {competitor.weaknesses.join(" / ") || "N/A"}</p>
                            <p className="text-indigo-200 text-[11px] mt-2">Whitespace: {competitor.whitespace || "N/A"}</p>
                          </div>
                        )) : (
                          <div className="bg-slate-950/30 rounded-lg border border-slate-900 p-3 text-slate-500 text-xs">
                            Competitor analysis will appear after the next successful intelligence run.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-905 p-4 border border-slate-800 rounded-xl flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-indigo-400 border-b border-slate-900 pb-2 font-mono text-xs">
                        <Flame className="w-4 h-4" />
                        <span className="font-bold uppercase tracking-wider">Customer persona generation</span>
                      </div>
                      <div className="flex flex-col gap-3 max-h-[320px] overflow-y-auto pr-1">
                        {currentBrandIntelligence.customerPersonaGeneration.length > 0 ? currentBrandIntelligence.customerPersonaGeneration.map((persona) => (
                          <div key={persona.personaName} className="bg-slate-950/30 rounded-lg border border-slate-900 p-3">
                            <strong className="text-slate-100 text-xs block">{persona.personaName}</strong>
                            <p className="text-slate-400 text-[11px] mt-1">{persona.demographics}</p>
                            <p className="text-slate-300 text-xs mt-2">{persona.psychographics}</p>
                            <p className="text-indigo-200 text-[11px] mt-2">Needs: {persona.coreNeeds.join(" / ") || "N/A"}</p>
                            <p className="text-rose-200 text-[11px] mt-1">Pain points: {persona.painPoints.join(" / ") || "N/A"}</p>
                            <p className="text-emerald-200 text-[11px] mt-1">Buying triggers: {persona.buyingTriggers.join(" / ") || "N/A"}</p>
                            <p className="text-slate-400 text-[11px] mt-1">Channels: {persona.preferredChannels.join(" / ") || "N/A"}</p>
                          </div>
                        )) : (
                          <div className="bg-slate-950/30 rounded-lg border border-slate-900 p-3 text-slate-500 text-xs">
                            Persona generation will appear after the next successful intelligence run.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-905 p-4 border border-slate-800 rounded-xl flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-indigo-400 border-b border-slate-900 pb-2 font-mono text-xs">
                        <BookOpen className="w-4 h-4" />
                        <span className="font-bold uppercase tracking-wider">Vocabulary & signature phrases</span>
                      </div>
                      <div className="bg-slate-950/30 rounded-lg border border-slate-900 p-3">
                        <p className="text-slate-400 text-[10px] font-mono uppercase tracking-wider">Preferred vocabulary</p>
                        <p className="text-slate-200 text-xs mt-2 leading-relaxed">
                          {currentBrandIntelligence.brandVoiceAnalyzer.vocabulary.join(" / ") || "No preferred vocabulary generated yet."}
                        </p>
                      </div>
                      <div className="bg-slate-950/30 rounded-lg border border-slate-900 p-3">
                        <p className="text-slate-400 text-[10px] font-mono uppercase tracking-wider">Signature phrases</p>
                        <p className="text-slate-200 text-xs mt-2 leading-relaxed">
                          {currentBrandIntelligence.brandVoiceAnalyzer.signaturePhrases.join(" / ") || "No signature phrases generated yet."}
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-905 p-4 border border-slate-800 rounded-xl flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-indigo-400 border-b border-slate-900 pb-2 font-mono text-xs">
                        <HelpCircle className="w-4 h-4" />
                        <span className="font-bold uppercase tracking-wider">Usage guidance</span>
                      </div>
                      <div className="bg-slate-950/30 rounded-lg border border-slate-900 p-3">
                        <p className="text-slate-400 text-[10px] font-mono uppercase tracking-wider">Do say</p>
                        <p className="text-emerald-200 text-xs mt-2 leading-relaxed">
                          {currentBrandIntelligence.brandVoiceAnalyzer.doSay.join(" / ") || "No approved phrasing guidance yet."}
                        </p>
                      </div>
                      <div className="bg-slate-950/30 rounded-lg border border-slate-900 p-3">
                        <p className="text-slate-400 text-[10px] font-mono uppercase tracking-wider">Avoid saying</p>
                        <p className="text-rose-200 text-xs mt-2 leading-relaxed">
                          {currentBrandIntelligence.brandVoiceAnalyzer.avoidSay.join(" / ") || "No blocked phrasing guidance yet."}
                        </p>
                      </div>
                      <div className="bg-slate-950/30 rounded-lg border border-slate-900 p-3">
                        <p className="text-slate-400 text-[10px] font-mono uppercase tracking-wider">Writing guidelines</p>
                        <p className="text-slate-200 text-xs mt-2 leading-relaxed">
                          {currentBrandIntelligence.toneOfVoiceAnalysis.writingGuidelines.join(" / ") || "No writing guidelines generated yet."}
                        </p>
                        <p className="text-slate-500 text-xs mt-2 leading-relaxed">
                          Avoided patterns: {currentBrandIntelligence.toneOfVoiceAnalysis.avoidedPatterns.join(" / ") || "None specified"}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === "creative" && (
                <motion.div
                  key="creative"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col gap-5 text-slate-200"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Scrolling hooks */}
                    <div className="bg-slate-905 p-4 border border-slate-800 rounded-xl flex flex-col gap-3 text-left">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-indigo-400 border-b border-slate-900 pb-1.5">Scroll-Stopping hooks</h4>
                      <ul className="flex flex-col gap-2 text-xs pr-1">
                        {currentAnalysis.creativeIntelligence.hooks.map((hook, idx) => {
                          const id = `hook-${idx}`;
                          const isCopied = copiedId === id;
                          return (
                            <li key={idx} className="p-2.5 bg-slate-950/30 rounded border border-slate-900 flex justify-between items-start gap-2 group">
                              <div className="flex gap-2">
                                <span className="text-indigo-400 font-mono font-extrabold shrink-0">H0{idx + 1}:</span>
                                <span className="text-slate-300 leading-normal">"{hook}"</span>
                              </div>
                              <button
                                onClick={() => handleCopy(hook, id)}
                                className="opacity-40 group-hover:opacity-100 hover:text-white p-1 rounded transition bg-slate-900 hover:bg-slate-800 border border-slate-800 shrink-0 text-slate-400"
                                title="Copy Hook Text"
                              >
                                {isCopied ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    {/* UGC Content outlines */}
                    <div className="bg-slate-905 p-4 border border-slate-800 rounded-xl flex flex-col gap-3 text-left">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-indigo-400 border-b border-slate-900 pb-1.5">User-Generated content (UGC) ideas</h4>
                      <ul className="flex flex-col gap-2.5 text-xs text-slate-400 leading-normal max-h-[250px] overflow-y-auto">
                        {currentAnalysis.creativeIntelligence.ugcIdeas.map((ugc, idx) => {
                          const id = `ugc-${idx}`;
                          const isCopied = copiedId === id;
                          return (
                            <li key={idx} className="flex justify-between items-start gap-2 p-2 bg-slate-950/20 border border-slate-900/60 rounded-lg group">
                              <div className="flex gap-2 text-left">
                                <div className="p-1 rounded bg-indigo-500/10 text-indigo-400 shrink-0 mt-0.5">
                                  <BookOpen className="w-3.5 h-3.5" />
                                </div>
                                <span>{ugc}</span>
                              </div>
                              <button
                                onClick={() => handleCopy(ugc, id)}
                                className="opacity-30 group-hover:opacity-100 hover:text-white p-1 rounded transition bg-slate-900 border border-slate-800/80 shrink-0 text-slate-400"
                                title="Copy UGC Outline"
                              >
                                {isCopied ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>

                  {/* Video Script storyboard concepts */}
                  {currentAnalysis.creativeIntelligence.videoConcepts.length > 0 && (
                    <div className="bg-slate-905 p-4 border border-slate-800 rounded-xl flex flex-col gap-3 text-left">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-indigo-400 border-b border-slate-900 pb-1.5 flex items-center gap-2 select-none">
                        <Tv className="w-4.5 h-4.5 text-indigo-400" /> High-Converting video script storyboard ({currentAnalysis.creativeIntelligence.videoConcepts[0].durationSeconds}s)
                      </h4>
                      <div className="p-3 bg-slate-950/40 rounded border border-slate-900 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono leading-normal leading-relaxed relative group">
                        <div className="relative p-2 rounded bg-slate-950/20 border border-slate-900/40">
                          <div className="flex items-center justify-between border-b border-slate-900 pb-1.5 mb-1.5">
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">VISUALS FLOW</span>
                            <button
                              onClick={() => handleCopy(currentAnalysis.creativeIntelligence.videoConcepts[0].visualFlow, "vid-visual")}
                              className="text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 p-1 rounded border border-slate-800 shrink-0"
                              title="Copy Scenario Visuals Flow"
                            >
                              {copiedId === "vid-visual" ? (
                                <span className="text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1"><Check className="w-3 h-3" /> Copied!</span>
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          <p className="text-slate-300 font-sans text-xs leading-relaxed">{currentAnalysis.creativeIntelligence.videoConcepts[0].visualFlow}</p>
                        </div>
                        <div className="relative p-2 rounded bg-slate-950/20 border border-slate-900/40 md:border-l md:border-slate-900 md:pl-4">
                          <div className="flex items-center justify-between border-b border-slate-900 pb-1.5 mb-1.5">
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">AUDIO DIALOGUE</span>
                            <button
                              onClick={() => handleCopy(currentAnalysis.creativeIntelligence.videoConcepts[0].audioDialogue, "vid-audio")}
                              className="text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 p-1 rounded border border-slate-800 shrink-0"
                              title="Copy Audio Dialogue Lines"
                            >
                              {copiedId === "vid-audio" ? (
                                <span className="text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1"><Check className="w-3 h-3" /> Copied!</span>
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          <p className="text-slate-200 mt-1 font-sans text-xs leading-relaxed">{currentAnalysis.creativeIntelligence.videoConcepts[0].audioDialogue}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === "history" && (
                <motion.div
                  key="history"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col gap-4 text-slate-200 font-mono text-xs"
                >
                  <h4 className="text-xs uppercase tracking-wider text-slate-400 border-b border-slate-900 pb-2">Analysis audit run modifications</h4>
                  <div className="flex flex-col gap-2.5">
                    {history.map((hist) => (
                      <div
                        key={hist.id}
                        onClick={() => {
                          setActiveHistoryAnalysis(hist);
                          setActiveTab("scores"); // go back to scores to let them review
                        }}
                        className={`p-3 rounded-lg border cursor-pointer select-none transition flex items-center justify-between ${
                          currentAnalysis.id === hist.id
                            ? "bg-indigo-950/40 border-indigo-500/50"
                            : "bg-slate-900/40 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-extrabold text-slate-100 flex items-center gap-1">
                            <span className="text-indigo-400 text-xs">V{hist.version}</span>
                          </span>
                          <div className="flex flex-col gap-1 text-[11px] text-slate-400 leading-none">
                            <span>Model: <strong className="text-slate-200">{hist.aiModel}</strong> ({hist.aiProvider})</span>
                            <span className="text-[10px] text-slate-500">Latency: {hist.latencyMilliseconds}ms | Confidence: {hist.confidenceScore}</span>
                          </div>
                        </div>

                        <div className="text-right flex items-center gap-3">
                          <div className="text-[11px]">
                            <span className="text-slate-400">Score: </span>
                            <span className="text-indigo-400 font-extrabold">{hist.opportunityScores.overall}</span>
                          </div>
                          {hist.isLatest ? (
                            <span className="px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[9px] uppercase font-bold tracking-wider">
                              LATEST
                            </span>
                          ) : (
                            <span className="text-slate-600 text-[10px]">archived</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/30 border border-slate-800 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center min-h-[220px]">
          <span className="text-slate-500 mb-2 block text-xs">NOT YET ANALYZED</span>
          <p className="text-xs text-slate-400 max-w-sm leading-relaxed mb-4">
            Create your very first high-fidelity growth marketing synthesis for this product item using real AI telemetry models.
          </p>
          <button
            onClick={handleRunAnalysis}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-850 disabled:text-indigo-400 text-white font-semibold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 transition"
          >
            {loading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>Analyze product opportunity</span>
          </button>
        </div>
      )}
      </div>

      {/* Credit ledger audit history accordion panel */}
      {ledger.length > 0 && (
        <div className="border-t border-slate-900 pt-5 mt-2">
          <details className="group">
            <summary className="text-[10px] font-mono uppercase tracking-widest text-slate-500 cursor-pointer select-none list-none hover:text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1"><Coins className="w-3 h-3 text-indigo-400" /> Accounting credit tracking ledger history ({ledger.length})</span>
              <span className="text-[9px] group-open:rotate-90 transition-transform duration-200">▶</span>
            </summary>
            
            <div className="mt-4 flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
              {ledger.map((entry) => (
                <div key={entry.id} className="p-3 bg-slate-950 border border-slate-900 rounded font-mono text-[10px] flex justify-between gap-4">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1 rounded text-[9px] font-bold ${
                        entry.amount < 0 ? "bg-rose-500/10 text-rose-400 border border-rose-500/10" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10"
                      }`}>
                        {entry.transactionType}
                      </span>
                      <span className="text-slate-400">{new Date(entry.createdAt).toLocaleDateString()} {new Date(entry.createdAt).toLocaleTimeString()}</span>
                    </div>
                    {entry.description && <p className="text-slate-300 mt-1 text-[11px] font-sans">{entry.description}</p>}
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`text-xs font-bold block ${entry.amount < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                      {entry.amount > 0 ? `+${entry.amount}` : entry.amount}
                    </span>
                    <span className="text-slate-500 text-[9px]">bal: {entry.runningBalance}</span>
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

    </div>
  );
}
