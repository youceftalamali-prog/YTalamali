import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Download, 
  Database, 
  ShieldCheck, 
  Coins, 
  History, 
  PlusCircle, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  ExternalLink,
  Cpu,
  Layers,
  Sparkles,
  RefreshCw,
  Eye,
  FileCode
} from "lucide-react";
import { NormalizedProduct, Workspace, ImportOperation, AuditLog } from "./types.ts";
import IntelligenceDashboard from "./components/IntelligenceDashboard.tsx";
import ContentStudio from "./components/ContentStudio.tsx";
import SocialPublishingCenter from "./components/social/SocialPublishingCenter.tsx";
import VideoStudio from "./components/video/VideoStudio.tsx";
import BillingDashboard from "./components/billing/BillingDashboard.tsx";
import ShopifySyncCenter from "./components/shopify/ShopifySyncCenter.tsx";
import QueueCenter from "./components/queue/QueueCenter.tsx";
import ImageStudio from "./components/ImageStudio.tsx";
import SettingsCenter from "./components/SettingsCenter.tsx";

// Pre-packaged DTC & Marketplace product presets for instant demoing
const PRESET_URLS = [
  {
    provider: "Shopify",
    name: "High Gloss",
    url: "https://kyliecosmetics.com/products/high-gloss",
  },
  {
    provider: "WooCommerce",
    name: "Classic Bifold Leather Wallet",
    url: "https://leatherworks.woo.com/product/classic-leather-wallet",
  },
  {
    provider: "Amazon",
    name: "Echo Spot Smart Alarm Clock",
    url: "https://amazon.com/dp/B018273_echo_clock",
  },
  {
    provider: "AliExpress",
    name: "RGB Mechanical Keyboard",
    url: "https://aliexpress.com/item/1005001273982-rgb-keyboard",
  },
  {
    provider: "Alibaba",
    name: "Eco Bamboo Wholesale Straws",
    url: "https://alibaba.com/product-detail/bamboo-fiber-straws-bulk",
  },
  {
    provider: "eBay",
    name: "Apple iPad Pro Refurbished",
    url: "https://ebay.com/itm/129837198-apple-ipad-pro-m4",
  },
];

type AppRoute =
  | "dashboard"
  | "projects"
  | "products"
  | "analytics"
  | "billing"
  | "shopify"
  | "queue"
  | "image"
  | "settings"
  | "product_detail";

type ProductCenterTab = "details" | "intelligence" | "history" | "content" | "publishing" | "video";
type IntelligenceTab = "analytics" | "scores" | "market" | "marketing" | "brand" | "creative" | "history";

export default function App() {
  const [workspaceId, setWorkspaceId] = useState<string>("default-workspace");
  const [url, setUrl] = useState<string>("");
  const [selectedProvider, setSelectedProvider] = useState<string>("Shopify");
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [rawHtml, setRawHtml] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Live Stats & Logs
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [products, setProducts] = useState<NormalizedProduct[]>([]);
  const [operations, setOperations] = useState<ImportOperation[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // State flags
  const [loading, setLoading] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedProductDetails, setSelectedProductDetails] = useState<NormalizedProduct | null>(null);

  // Import status polling
  const [importStatus, setImportStatus] = useState<{
    operationId: string | null;
    status: string | null;
    provider: string | null;
    errorMessage: string | null;
    attemptCount: number | null;
    product: NormalizedProduct | null;
  }>({
    operationId: null,
    status: null,
    provider: null,
    errorMessage: null,
    attemptCount: null,
    product: null,
  });

  // Navigation State
  const [activeRoute, setActiveRoute] = useState<AppRoute>("dashboard");
  const [productCenterTab, setProductCenterTab] = useState<ProductCenterTab>("details");
  const [intelligenceInitialTab, setIntelligenceInitialTab] = useState<IntelligenceTab>("analytics");

  // Gallery Active Image State
  const [activeProductImage, setActiveProductImage] = useState<string | null>(null);

  // Sync active image with product change
  useEffect(() => {
    if (selectedProductDetails) {
      setActiveProductImage(selectedProductDetails.images);
    } else {
      setActiveProductImage(null);
    }
  }, [selectedProductDetails]);

  // Sync data from Express API
  const fetchData = async (targetTenantId = workspaceId) => {
    try {
      const tenantParam = `?workspaceId=${targetTenantId}`;
      const [wsRes, prodRes, opsRes, logsRes] = await Promise.all([
        fetch(`/api/workspace${tenantParam}`),
        fetch(`/api/products${tenantParam}`),
        fetch(`/api/operations${tenantParam}`),
        fetch(`/api/audit-logs${tenantParam}`),
      ]);

      if (wsRes.ok && prodRes.ok && opsRes.ok && logsRes.ok) {
        setWorkspace(await wsRes.json());
        const fetchedProds = await prodRes.json();
        setProducts(fetchedProds);
        setOperations(await opsRes.json());
        setAuditLogs(await logsRes.json());

        // Update selected product reference in place to sync state
        if (selectedProductDetails) {
          const updatedProd = fetchedProds.find((p: NormalizedProduct) => p.id === selectedProductDetails.id);
          if (updatedProd) {
            setSelectedProductDetails(updatedProd);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching multi-tenant isolated workspace details:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [workspaceId]);

  // Handle tenant/workspace changes (Isolation Validation)
  const handleTenantChange = (tenantId: string) => {
    setWorkspaceId(tenantId);
    setSelectedProductDetails(null);
    setIntelligenceInitialTab("analytics");
    setActiveRoute("dashboard");
    setErrorText(null);
    setSuccessMessage(null);
    setImportStatus({
      operationId: null,
      status: null,
      provider: null,
      errorMessage: null,
      attemptCount: null,
      product: null,
    });
  };

  // Perform refilling action
  const handleRefillCredits = async (amount: number) => {
    try {
      const res = await fetch("/api/set-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, amount }),
      });
      if (res.ok) {
        setSuccessMessage(`Workspace credits successfully set to ${amount}.`);
        fetchData();
      }
    } catch (err) {
      console.error("Failed to update workspace credits balance:", err);
    }
  };

  // Poll import status
  const pollImportStatus = (operationId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/import/status/${operationId}?workspaceId=${workspaceId}`);
        if (!res.ok) {
          if (res.status === 404) {
            clearInterval(pollInterval);
            setErrorText("Import operation not found.");
            setLoading(false);
          }
          return;
        }
        const data = await res.json();
        setImportStatus({
          operationId: data.id,
          status: data.status,
          provider: data.provider,
          errorMessage: data.errorMessage,
          attemptCount: data.attemptCount,
          product: data.product,
        });

        if (data.status === "success") {
          clearInterval(pollInterval);
          setSuccessMessage(`✅ Import successful! Product "${data.product?.title}" cataloged.`);
          setSelectedProductDetails(data.product);
          setActiveRoute("product_detail");
          setProductCenterTab("details");
          setLoading(false);
          fetchData();
        } else if (data.status === "failed") {
          clearInterval(pollInterval);
          const provider = data.provider || "Unknown";
          const attempts = data.attemptCount || 0;
          const reason = data.errorMessage || "Unknown error";
          setErrorText(
            `❌ Import Failed\nProvider: ${provider}\nReason: ${reason}\nAttempts: ${attempts}`
          );
          setLoading(false);
          fetchData();
        } else {
          // Update status message
          setSuccessMessage(`⏳ Import status: ${data.status} ${data.attemptCount ? `(attempt ${data.attemptCount})` : ""}`);
        }
      } catch (err) {
        console.error("Polling error:", err);
        clearInterval(pollInterval);
        setErrorText("Error checking import status.");
        setLoading(false);
      }
    }, 2000);

    // Cleanup after 2 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      if (importStatus.status !== "success" && importStatus.status !== "failed") {
        setErrorText("Import timed out. Check queue for details.");
        setLoading(false);
      }
    }, 120000);
  };

  // Trigger Import Operation
  const handleTriggerImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setErrorText("Please state a valid source URL or click a preset listing.");
      return;
    }

    setLoading(true);
    setErrorText(null);
    setSuccessMessage(null);
    setImportStatus({
      operationId: null,
      status: null,
      provider: null,
      errorMessage: null,
      attemptCount: null,
      product: null,
    });

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          workspaceId,
          customPrompt: customPrompt.trim() || undefined,
          rawHtml: rawHtml.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed importing product listing.");
      }

      const operationId = data.operation?.id;
      if (operationId) {
        setSuccessMessage(`⏳ Import queued (ID: ${operationId}). Monitoring progress...`);
        pollImportStatus(operationId);
      } else {
        setSuccessMessage("Product import queued for background processing.");
        setLoading(false);
      }

      setUrl("");
      setCustomPrompt("");
      setRawHtml("");
      fetchData();
    } catch (err: any) {
      setErrorText(err.message || "An unexpected error occurred during extraction.");
      setLoading(false);
      fetchData();
    }
  };

  const handleViewProductDetails = (product: NormalizedProduct) => {
    setSelectedProductDetails(product);
    setIntelligenceInitialTab("analytics");
    setActiveRoute("product_detail");
    setProductCenterTab("details");
  };

  const ensureSelectedProduct = () => {
    const fallbackProduct = selectedProductDetails || products[0] || null;
    if (fallbackProduct) {
      setSelectedProductDetails(fallbackProduct);
    }
    return fallbackProduct;
  };

  const openProductTab = (tab: ProductCenterTab) => {
    const product = ensureSelectedProduct();
    if (!product) {
      setErrorText("Import or select a product first to unlock this module.");
      setActiveRoute("products");
      return;
    }
    setActiveRoute("product_detail");
    setProductCenterTab(tab);
    if (tab === "history") {
      setIntelligenceInitialTab("history");
    } else if (tab === "intelligence") {
      setIntelligenceInitialTab("analytics");
    }
  };

  const openIntelligenceModule = (tab: IntelligenceTab, route: AppRoute = "product_detail") => {
    const product = ensureSelectedProduct();
    if (!product) {
      setErrorText("Import or select a product first to unlock this module.");
      setActiveRoute("products");
      return;
    }
    setIntelligenceInitialTab(tab);
    setProductCenterTab(tab === "history" ? "history" : "intelligence");
    setActiveRoute(route);
  };

  const openImageStudio = () => {
    const product = ensureSelectedProduct();
    if (!product) {
      setErrorText("Import or select a product first to open Image Studio.");
      setActiveRoute("products");
      return;
    }
    setActiveRoute("image");
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 font-sans transition-colors duration-200">
      
      {/* Platform Title Bar */}
      <header className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-8 border-b border-slate-800 gap-4">
        <div>
          <span className="text-xs font-mono text-indigo-400 uppercase tracking-widest flex items-center gap-1.5 mb-1 text-indigo-400 flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 animate-pulse" /> DTC & Marketplace Ingest Engine
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            AuraPost AI <span className="text-sm font-normal px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">Phase 8 Command Center</span>
          </h1>
        </div>

        {/* Tenant Switcher and Security Gated Guard */}
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div>
            <label className="text-xs font-mono text-slate-400 block mb-1 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-indigo-400" /> Isolated Tenant Space
            </label>
            <select
              value={workspaceId}
              onChange={(e) => handleTenantChange(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-sm text-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
            >
              <option value="default-workspace">Primary Workspace (500 Credits)</option>
              <option value="competitor-tenant">Malicious Competitor LLC (100 Credits)</option>
              <option value="exhausted-tenant">Out of Credits Corp (10 Credits)</option>
            </select>
          </div>
          <div className="text-xs font-mono text-slate-400 px-3 py-1 bg-slate-900 border border-slate-800 rounded">
            Tenant ID: <span className="text-indigo-400 font-bold">{workspaceId}</span>
          </div>
        </div>
      </header>

      {/* Global High-Contrast Navigation Bar & Breadcrumb Interface */}
      <nav className="bg-slate-950 border border-slate-800 rounded-xl p-3 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-3 select-none">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 font-mono text-xs no-scrollbar">
          <button
            onClick={() => setActiveRoute("dashboard")}
            className={`px-3 py-2 rounded-lg transition ${
              activeRoute === "dashboard"
                ? "bg-indigo-600 text-white font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            📊 Dashboard
          </button>
          
          <span className="text-slate-600">/</span>
          
          <button
            onClick={() => setActiveRoute("projects")}
            className={`px-3 py-2 rounded-lg transition ${
              activeRoute === "projects"
                ? "bg-indigo-600 text-white font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            📂 Projects
          </button>
          
          <span className="text-slate-600">/</span>

          <button
            onClick={() => setActiveRoute("products")}
            className={`px-3 py-2 rounded-lg transition ${
              activeRoute === "products"
                ? "bg-indigo-600 text-white font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            📦 Products Catalog
          </button>

          <span className="text-slate-600">/</span>

          <button
            onClick={() => openIntelligenceModule("analytics", "analytics")}
            className={`px-3 py-2 rounded-lg transition ${
              activeRoute === "analytics"
                ? "bg-indigo-600 text-white font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            📈 Analytics
          </button>

          <span className="text-slate-600">/</span>

          <button
            onClick={() => setActiveRoute("billing")}
            className={`px-3 py-2 rounded-lg transition ${
              activeRoute === "billing"
                ? "bg-indigo-600 text-white font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            💳 Billing
          </button>

          <span className="text-slate-600">/</span>

          <button
            onClick={() => setActiveRoute("shopify")}
            className={`px-3 py-2 rounded-lg transition ${
              activeRoute === "shopify"
                ? "bg-indigo-600 text-white font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            🛍️ Shopify Sync
          </button>

          <span className="text-slate-600">/</span>

          <button
            onClick={() => setActiveRoute("queue")}
            className={`px-3 py-2 rounded-lg transition ${
              activeRoute === "queue"
                ? "bg-indigo-600 text-white font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            ⚙️ Queue Center
          </button>

          <span className="text-slate-600">/</span>

          <button
            onClick={openImageStudio}
            className={`px-3 py-2 rounded-lg transition ${
              activeRoute === "image"
                ? "bg-indigo-600 text-white font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            🖼️ Image Studio
          </button>

          <span className="text-slate-600">/</span>

          <button
            onClick={() => setActiveRoute("settings")}
            className={`px-3 py-2 rounded-lg transition ${
              activeRoute === "settings"
                ? "bg-indigo-600 text-white font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            🔧 Settings
          </button>

          {selectedProductDetails && (
            <>
              <span className="text-slate-600">/</span>
              <button
                onClick={() => setActiveRoute("product_detail")}
                className={`px-3 py-2 rounded-lg transition text-indigo-400 font-bold max-w-[150px] truncate ${
                  activeRoute === "product_detail"
                    ? "bg-indigo-950 border border-indigo-500/20"
                    : "hover:text-indigo-300"
                }`}
              >
                🔬 {selectedProductDetails.title}
              </button>
            </>
          )}
        </div>

        {/* Floating Credit Balance Indicator */}
        <div className="flex items-center gap-3 font-mono text-xs text-slate-300 bg-slate-900 border border-slate-800/80 px-3 py-2 rounded-lg shrink-0">
          <Coins className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
          <span>Credits Remaining: </span>
          <strong className="text-indigo-300 transform scale-110 duration-200 font-bold text-sm block">{workspace ? workspace.credits : "0"}</strong>
          {workspace?.plan && (
            <span className="px-2 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] uppercase">
              {workspace.plan}
            </span>
          )}
          {workspace?.creditPools && (
            Object.values(workspace.creditPools).some((value) => typeof value === "object" && "balance" in value && value.balance <= 0)
          ) && (
            <button
              onClick={() => setActiveRoute("billing")}
              className="px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold"
            >
              Upgrade
            </button>
          )}
        </div>
      </nav>

      {/* Main Content Panels Routed State */}
      <AnimatePresence mode="wait">
        
        {/* ROUTE 1: DASHBOARD */}
        {activeRoute === "dashboard" && (
          <motion.div
            key="dashboard-view"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            
            {/* Left Column: Import / Test Presets */}
            <div className="lg:col-span-7 flex flex-col gap-6">

              <div className="bg-slate-950/40 border border-slate-800 p-5 rounded-xl shadow-lg">
                <div className="flex items-center justify-between mb-4 gap-3">
                  <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5 font-mono">
                    <Layers className="w-4 h-4 text-indigo-400" /> MODULE LAUNCHPAD
                  </h2>
                  <span className="text-xs font-mono text-slate-400">Every required surface is linked here</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <button onClick={() => setActiveRoute("dashboard")} className="text-left rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 px-4 py-3 transition">
                    <div className="text-sm text-white font-semibold">Dashboard</div>
                    <div className="text-[11px] text-slate-400 mt-1">Overview and workspace health</div>
                  </button>
                  <button onClick={() => setActiveRoute("dashboard")} className="text-left rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 px-4 py-3 transition">
                    <div className="text-sm text-white font-semibold">Product Import</div>
                    <div className="text-[11px] text-slate-400 mt-1">Import products from URLs or raw HTML</div>
                  </button>
                  <button onClick={() => openIntelligenceModule("scores")} className="text-left rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 px-4 py-3 transition">
                    <div className="text-sm text-white font-semibold">Product Analyzer</div>
                    <div className="text-[11px] text-slate-400 mt-1">Run opportunity scoring and analysis</div>
                  </button>
                  <button onClick={() => openProductTab("content")} className="text-left rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 px-4 py-3 transition">
                    <div className="text-sm text-white font-semibold">AI Content Studio</div>
                    <div className="text-[11px] text-slate-400 mt-1">Hooks, scripts, emails, landing copy</div>
                  </button>
                  <button onClick={() => openProductTab("video")} className="text-left rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 px-4 py-3 transition">
                    <div className="text-sm text-white font-semibold">Video Studio</div>
                    <div className="text-[11px] text-slate-400 mt-1">AI video queue, providers, render history</div>
                  </button>
                  <button onClick={openImageStudio} className="text-left rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 px-4 py-3 transition">
                    <div className="text-sm text-white font-semibold">Image Studio</div>
                    <div className="text-[11px] text-slate-400 mt-1">Prompt packs, shot lists, asset board</div>
                  </button>
                  <button onClick={() => openProductTab("publishing")} className="text-left rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 px-4 py-3 transition">
                    <div className="text-sm text-white font-semibold">Social Publishing</div>
                    <div className="text-[11px] text-slate-400 mt-1">Accounts, calendar, queue, analytics</div>
                  </button>
                  <button onClick={() => setActiveRoute("shopify")} className="text-left rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 px-4 py-3 transition">
                    <div className="text-sm text-white font-semibold">Shopify Integration</div>
                    <div className="text-[11px] text-slate-400 mt-1">Stores, sync jobs, webhooks, automation</div>
                  </button>
                  <button onClick={() => openIntelligenceModule("analytics", "analytics")} className="text-left rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 px-4 py-3 transition">
                    <div className="text-sm text-white font-semibold">Analytics</div>
                    <div className="text-[11px] text-slate-400 mt-1">Workspace and product performance</div>
                  </button>
                  <button onClick={() => setActiveRoute("billing")} className="text-left rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 px-4 py-3 transition">
                    <div className="text-sm text-white font-semibold">Billing</div>
                    <div className="text-[11px] text-slate-400 mt-1">Plans, invoices, payments, usage</div>
                  </button>
                  <button onClick={() => openIntelligenceModule("brand")} className="text-left rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 px-4 py-3 transition">
                    <div className="text-sm text-white font-semibold">Brand Intelligence</div>
                    <div className="text-[11px] text-slate-400 mt-1">Voice, positioning, personas, identity</div>
                  </button>
                  <button onClick={() => setActiveRoute("queue")} className="text-left rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 px-4 py-3 transition">
                    <div className="text-sm text-white font-semibold">Queue System</div>
                    <div className="text-[11px] text-slate-400 mt-1">Workers, retries, dead-letter jobs</div>
                  </button>
                  <button onClick={() => setActiveRoute("settings")} className="text-left rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 px-4 py-3 transition md:col-span-3">
                    <div className="text-sm text-white font-semibold">Settings</div>
                    <div className="text-[11px] text-slate-400 mt-1">Runtime health, credit pools, integration posture</div>
                  </button>
                </div>
              </div>
              
              {/* Test Presets */}
              <div className="bg-slate-950/40 border border-slate-800 p-5 rounded-xl shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5 font-mono">
                    <Sparkles className="w-4 h-4 text-amber-400" /> PLATFORM TEST PRESETS
                  </h2>
                  <span className="text-xs font-mono text-indigo-400">Select any source</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                  {PRESET_URLS.map((item) => (
                    <button
                      key={item.name}
                      onClick={() => {
                        setUrl(item.url);
                        setSelectedProvider(item.provider);
                      }}
                      className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all ${
                        url === item.url
                          ? "bg-indigo-950/40 border-indigo-500/50 hover:bg-indigo-950/60"
                          : "bg-slate-900/60 border-slate-800/80 hover:bg-slate-800/70 hover:border-slate-700"
                      }`}
                    >
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 mb-1.5 border border-slate-700/60">
                        {item.provider}
                      </span>
                      <span className="text-xs text-slate-300 truncate w-full font-sans">
                        {item.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Ingest Form */}
              <form onSubmit={handleTriggerImport} className="bg-slate-950/60 border border-slate-800 p-6 rounded-xl flex flex-col gap-5 shadow-lg">
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3 font-mono">
                  <Download className="w-5 h-5 text-indigo-500 animate-bounce" /> IMPORT NEW PRODUCT LISTING
                </h2>

                {errorText && (
                  <div className="bg-rose-950/40 border border-rose-500/30 p-3.5 rounded-lg text-rose-300 text-xs flex items-start gap-2.5 animate-pulse whitespace-pre-wrap">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
                    <div>
                      <span className="font-semibold block">Failed Ingest Transaction</span>
                      {errorText}
                    </div>
                  </div>
                )}

                {successMessage && (
                  <div className="bg-emerald-950/40 border border-emerald-500/30 p-3.5 rounded-lg text-emerald-300 text-xs flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
                    <div>
                      <span className="font-semibold block">Import Status</span>
                      {successMessage}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono text-slate-400">Platform Listing URL</label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://..."
                    className="bg-slate-900 border border-slate-700 text-sm rounded-lg p-2.5 px-3.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-100 font-mono placeholder:text-slate-600"
                  />
                  <span className="text-[10px] font-mono text-slate-500">
                    Standard action costs <strong className="text-indigo-400 font-bold">20 credits</strong>
                  </span>
                </div>

                <div className="border-t border-slate-900 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-xs font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1 bg-slate-900/40 border border-slate-800 px-2.5 py-1 rounded transition"
                  >
                    <Layers className="w-3.5 h-3.5 text-indigo-400" /> {showAdvanced ? "Hide Advanced Overrides" : "Show Advanced Options"}
                  </button>

                  {showAdvanced && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="flex flex-col gap-4 mt-4 bg-slate-900/30 p-4 border border-slate-800 rounded-lg text-xs"
                    >
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-mono text-slate-400">Custom Extract Instructions (Gemini Guidance)</label>
                        <textarea
                          value={customPrompt}
                          onChange={(e) => setCustomPrompt(e.target.value)}
                          placeholder="Translate details to French, extract custom pricing margins..."
                          className="bg-slate-900 border border-slate-700 text-xs rounded p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-mono text-slate-300 flex items-center gap-1">
                          <FileCode className="w-3 h-3 text-indigo-400" /> Raw Product HTML/JSON Data (Fallback Override)
                        </label>
                        <textarea
                          value={rawHtml}
                          onChange={(e) => setRawHtml(e.target.value)}
                          rows={4}
                          placeholder="Paste raw structured script/JSON metadata or raw HTML to test direct structural extraction."
                          className="bg-slate-900 border border-slate-700 text-xs rounded p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200 font-mono"
                        />
                      </div>
                    </motion.div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm p-3 rounded-lg disabled:bg-indigo-800 disabled:text-indigo-300/40 relative flex items-center justify-center gap-2 transition select-none"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Processing Extraction... (Gemini Scanning Schema)</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-white" />
                      <span>Execute High-Fidelity Import</span>
                    </>
                  )}
                </button>
              </form>

            </div>

            {/* Right Column: Key Dashboard Metrics & System Operations Logs */}
            <div className="lg:col-span-12 lg:grid lg:grid-cols-2 gap-6 flex flex-col">
              
              {/* Quick Metrics Bento Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl shadow-lg flex flex-col justify-between h-28">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">Cataloged Items</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-white font-mono">{products.length}</span>
                    <span className="text-xs text-indigo-400 font-semibold font-mono">Active</span>
                  </div>
                  <button
                    onClick={() => setActiveRoute("products")}
                    className="mt-3 text-left text-[11px] font-mono text-indigo-400 hover:text-indigo-300 block"
                  >
                    View Catalog →
                  </button>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl shadow-lg flex flex-col justify-between h-28">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">Deduction Cost</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-white font-mono">20</span>
                    <span className="text-xs text-rose-400 font-semibold font-mono">Credits</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 block mt-3">Clean uniform rate</span>
                </div>
              </div>

              {/* Catalog Inventory Widget (SQLite backend) */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-lg">
                <div className="bg-slate-950 p-4 border-b border-slate-800/80 flex items-center justify-between">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-indigo-400" /> LATEST CATALOG ({products.length})
                  </h3>
                  <button
                    onClick={() => setActiveRoute("products")}
                    className="text-[10px] font-mono text-indigo-400 hover:text-indigo-300"
                  >
                    Show all
                  </button>
                </div>

                <div className="divide-y divide-slate-950 divide-y-slate-900/60 max-h-56 overflow-y-auto">
                  {products.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500 font-mono">
                      Your inventory is empty. Pick a preset above to begin.
                    </div>
                  ) : (
                    products.slice(0, 4).map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleViewProductDetails(item)}
                        className="p-3 hover:bg-slate-900/40 cursor-pointer flex items-center justify-between transition text-xs font-mono"
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <img
                            src={item.images}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-8 h-8 rounded object-cover border border-slate-800 bg-slate-950 shrink-0"
                          />
                          <div className="overflow-hidden text-left">
                            <span className="text-[9px] font-mono font-bold bg-indigo-500/15 text-indigo-300 px-1 py-0.2 rounded mr-1.5 inline-block">
                              {item.vendor}
                            </span>
                            <span className="text-slate-200 truncate font-semibold block mt-1">{item.title}</span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right font-mono text-xs text-indigo-400 font-bold ml-2">
                          {item.currency} {item.price}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Persistent Operations and Audit Tracker */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-lg">
                <div className="bg-slate-950 p-4 border-b border-slate-800/80">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-indigo-400" /> PIPELINE OPERATIONS AUDITS
                  </h3>
                </div>

                <div className="divide-y divide-slate-900/60 max-h-52 overflow-y-auto">
                  {operations.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500 font-mono">
                      No ingestion runs found on database.
                    </div>
                  ) : (
                    operations.slice(0, 5).map((op) => (
                      <div key={op.id} className="p-3 text-[11px] flex flex-col gap-1 hover:bg-slate-900/10">
                        <div className="flex items-center justify-between font-mono text-[10px]">
                          <span className="font-bold text-indigo-300 bg-slate-900 px-1 rounded">{op.provider}</span>
                          <span className={`px-2 py-0.2 rounded-full text-[9px] uppercase font-bold text-[8px] ${
                            op.status === "success" 
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}>
                            {op.status}
                          </span>
                        </div>
                        <div className="text-slate-400 font-mono truncate text-[10px] text-left">{op.sourceUrl}</div>
                        <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                          <span>Debits: {op.creditCharged} credits</span>
                          <span>{new Date(op.createdAt).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

          </motion.div>
        )}

        {/* ROUTE 2: PROJECTS / MULTI-TENANT WORKSPACE DEMONSTRATOR */}
        {activeRoute === "projects" && (
          <motion.div
            key="projects"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="flex flex-col gap-6"
          >
            <div className="bg-slate-950/60 border border-slate-800 p-6 rounded-xl shadow-lg">
              <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2 font-mono uppercase tracking-wide">
                <ShieldCheck className="w-5 h-5 text-indigo-400 animate-pulse" /> MULTI-TENANTED workspace BOUNDARIES
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed max-w-3xl mb-6 font-sans">
                All SQLite persistent catalog rows, accounting transaction ledgers, credit balances, and intelligence history versions are partitioned at the database layer using explicit tenant constraints. Selecting a workspace below isolates your session.
              </p>

              {/* Three Workspace Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                {/* Default Primary */}
                <div
                  onClick={() => handleTenantChange("default-workspace")}
                  className={`p-5 rounded-xl border transition cursor-pointer flex flex-col justify-between h-48 select-none ${
                    workspaceId === "default-workspace"
                      ? "bg-indigo-950/40 border-indigo-500"
                      : "bg-slate-900/30 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between font-mono mb-2">
                      <span className="text-xs font-bold text-slate-100 font-mono">Primary Workspace</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-bold font-mono">DEFAULT</span>
                    </div>
                    <p className="text-[11px] text-slate-405 leading-relaxed font-sans mt-2">
                      Simulates a standard client company space with 500 allocated credits and active pre-loaded items.
                    </p>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-850 pt-3">
                    <span className="text-[10px] font-mono text-slate-500">Balance:</span>
                    <strong className="text-indigo-300 font-mono text-sm">
                      {workspaceId === "default-workspace" && workspace ? workspace.credits : "500"} Credits
                    </strong>
                  </div>
                </div>

                {/* Malicious Competitor */}
                <div
                  onClick={() => handleTenantChange("competitor-tenant")}
                  className={`p-5 rounded-xl border transition cursor-pointer flex flex-col justify-between h-48 select-none ${
                    workspaceId === "competitor-tenant"
                      ? "bg-indigo-950/40 border-indigo-500"
                      : "bg-slate-900/30 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between font-mono mb-2">
                      <span className="text-xs font-bold text-slate-100 text-indigo-300 font-mono">Malicious Competitor LLC</span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[9px] font-bold font-mono">SANDBOX</span>
                    </div>
                    <p className="text-[11px] text-slate-405 leading-relaxed font-sans mt-2">
                      Shows robust row isolation; items added or analysed here cannot be queried from any other session space.
                    </p>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-850 pt-3">
                    <span className="text-[10px] font-mono text-slate-500">Balance:</span>
                    <strong className="text-indigo-300 font-mono text-sm">
                      {workspaceId === "competitor-tenant" && workspace ? workspace.credits : "100"} Credits
                    </strong>
                  </div>
                </div>

                {/* Exhausted Out of Credits */}
                <div
                  onClick={() => handleTenantChange("exhausted-tenant")}
                  className={`p-5 rounded-xl border transition cursor-pointer flex flex-col justify-between h-48 select-none ${
                    workspaceId === "exhausted-tenant"
                      ? "bg-indigo-950/40 border-indigo-500"
                      : "bg-slate-900/30 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between font-mono mb-2">
                      <span className="text-xs font-bold text-slate-350 font-mono">Out of Credits Corp</span>
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 text-[9px] font-bold font-mono">LOCKOUT</span>
                    </div>
                    <p className="text-[11px] text-slate-405 leading-relaxed font-sans mt-2">
                      Provides testing fail-safes. Attempting to ingest or analyze products redirects to immediate credit lockout triggers.
                    </p>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-850 pt-3">
                    <span className="text-[10px] font-mono text-slate-500">Balance:</span>
                    <strong className="text-rose-400 font-mono text-sm">
                      {workspaceId === "exhausted-tenant" && workspace ? workspace.credits : "10"} Credits
                    </strong>
                  </div>
                </div>
              </div>

              {/* Tenant Credit Modification tools inside Projects */}
              <div className="border-t border-slate-900 pt-6">
                <h4 className="text-xs uppercase tracking-wider font-mono text-slate-400 mb-4 font-bold select-none text-left">Workspace Balance Accounting Operations</h4>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => handleRefillCredits(500)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs px-4 py-2.5 rounded-lg font-bold transition shadow"
                  >
                    Set Active Workspace credits to 500
                  </button>
                  <button
                    onClick={() => handleRefillCredits(10)}
                    className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 font-mono text-xs px-4 py-2.5 rounded-lg transition"
                  >
                    Exhaust active Workspace to 10 credits
                  </button>
                </div>
              </div>

            </div>

            {/* In-depth transaction audit ledger table */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-6 shadow-lg text-left">
              <h3 className="text-xs font-bold text-white mb-4 flex items-center gap-2 font-mono uppercase select-none font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Live Workspace security logs
              </h3>
              <div className="flex flex-col gap-3 font-mono text-[10px] max-h-72 overflow-y-auto pr-1">
                {auditLogs.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">Security audit logs are currently empty.</div>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id} className="p-3 bg-slate-950 border border-slate-900 rounded-lg flex flex-col gap-1">
                      <div className="flex items-center justify-between border-b border-slate-900 pb-1 mb-1">
                        <span className="text-[9px] bg-slate-900 px-1 rounded font-bold text-indigo-300">{log.action}</span>
                        <span className="text-slate-500">{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-xs font-sans text-slate-300 leading-relaxed font-sans">{log.details}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

          </motion.div>
        )}

        {activeRoute === "billing" && (
          <motion.div
            key="billing"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            <BillingDashboard
              workspaceId={workspaceId}
              workspace={workspace}
              onWorkspaceRefresh={() => fetchData(workspaceId)}
            />
          </motion.div>
        )}

        {activeRoute === "shopify" && (
          <motion.div
            key="shopify"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            <ShopifySyncCenter
              workspaceId={workspaceId}
              workspace={workspace}
              onWorkspaceRefresh={() => fetchData(workspaceId)}
            />
          </motion.div>
        )}

        {activeRoute === "queue" && (
          <motion.div
            key="queue"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            <QueueCenter
              workspaceId={workspaceId}
              workspace={workspace}
              onWorkspaceRefresh={() => fetchData(workspaceId)}
            />
          </motion.div>
        )}

        {activeRoute === "analytics" && (
          <motion.div
            key="analytics"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            <IntelligenceDashboard
              selectedProduct={selectedProductDetails || products[0] || null}
              workspaceId={workspaceId}
              userCredits={workspace ? workspace.credits : 0}
              onAnalysisSuccess={() => fetchData(workspaceId)}
              initialTab="analytics"
            />
          </motion.div>
        )}

        {activeRoute === "image" && (
          <motion.div
            key="image"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            <ImageStudio
              selectedProduct={selectedProductDetails || products[0] || null}
              workspaceId={workspaceId}
            />
          </motion.div>
        )}

        {activeRoute === "settings" && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            <SettingsCenter
              workspaceId={workspaceId}
              workspace={workspace}
              onWorkspaceRefresh={() => fetchData(workspaceId)}
            />
          </motion.div>
        )}

        {/* ROUTE 3: PRODUCTS CATALOG GRID VIEW */}
        {activeRoute === "products" && (
          <motion.div
            key="products"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="flex flex-col gap-6"
          >
            <div className="bg-slate-950/60 border border-slate-800 p-6 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="text-left">
                <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2 uppercase">
                  <Database className="w-5 h-5 text-indigo-400 animate-pulse animate-duration-1000" /> PERSISTENT PRODUCTS CATALOG
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed max-w-lg mt-1 font-sans">
                  Manage imported merchant products. Click any catalog item card to open the complete **Product Command Center**.
                </p>
              </div>

              <button
                onClick={() => { setActiveRoute("dashboard"); }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono font-bold text-xs px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition whitespace-nowrap self-stretch md:self-auto text-center justify-center font-mono"
              >
                <PlusCircle className="w-4 h-4" /> Import New Product
              </button>
            </div>

            {products.length === 0 ? (
              <div className="bg-slate-950/60 border border-slate-800 border-dashed rounded-xl p-16 text-center flex flex-col items-center justify-center shadow-lg">
                <Database className="w-10 h-10 text-slate-600 animate-pulse mb-3" />
                <h3 className="text-md font-bold text-slate-305">Catalog Inventory is Empty</h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1 mb-5">
                  Import a product page via the dashboard to create SQLite entries and run marketing Opportunity scores.
                </p>
                <button
                  onClick={() => setActiveRoute("dashboard")}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4  py-2 rounded-lg"
                >
                  Import From Presets
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleViewProductDetails(item)}
                    className="bg-slate-950/60 border border-slate-800 hover:border-indigo-500/40 rounded-xl overflow-hidden cursor-pointer transition flex flex-col justify-between shadow-md group"
                  >
                    <div className="p-4 flex flex-col gap-3">
                      <div className="relative">
                        <img
                          src={item.images}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-44 object-cover rounded-lg border border-slate-900 bg-slate-900 group-hover:scale-102 transition duration-300"
                        />
                        <span className="absolute top-2.5 left-2.5 bg-slate-950/80 border border-slate-800 font-mono text-[9px] font-bold px-2 py-0.5 rounded text-indigo-300 uppercase">
                          {item.vendor}
                        </span>
                      </div>

                      <div className="flex flex-col gap-1.5 mt-1 text-left font-sans">
                        <h3 className="text-sm font-bold text-slate-200 group-hover:text-indigo-400 transition line-clamp-1">{item.title}</h3>
                        <p className="text-xs text-slate-404 line-clamp-2 leading-relaxed min-h-[32px] text-slate-400">{item.description}</p>
                      </div>
                    </div>

                    <div className="bg-slate-950 border-t border-slate-900/60 p-4 shrink-0 flex items-center justify-between font-mono text-xs">
                      <div className="text-left font-mono">
                        <span className="text-slate-505 text-[10px] block text-slate-500">Price</span>
                        <strong className="text-white font-extrabold text-sm">{item.currency} {item.price}</strong>
                      </div>
                      
                      <button className="bg-indigo-950 hover:bg-indigo-900 border border-indigo-505/35 text-indigo-300 font-bold px-3 py-1.5 rounded text-[11px] transition">
                        Open Center →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ROUTE 4: PRODUCT COMPREHENSIVE COMMAND CENTER (TABS: Product Details, Intelligence, History) */}
        {activeRoute === "product_detail" && selectedProductDetails && (
          <motion.div
            key="product_detail"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="flex flex-col gap-6"
          >
            {/* Header Command bar */}
            <div className="bg-slate-950/60 border border-slate-800 p-5 rounded-xl shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="text-left">
                <button
                  onClick={() => setActiveRoute("products")}
                  className="text-[10px] font-mono text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mb-2 select-none uppercase font-bold"
                >
                  ← Back to products catalog
                </button>
                <h2 className="text-lg font-bold text-white flex items-center gap-2 max-w-xl truncate">
                  <span className="px-1.5 py-0.5 rounded bg-indigo-505/10 text-indigo-300 text-xs font-mono font-bold uppercase select-none">{selectedProductDetails.vendor}</span>
                  {selectedProductDetails.title}
                </h2>
              </div>

              {/* Sub-tab selection pillbox */}
              <div className="flex border border-slate-805 bg-slate-900 rounded-lg p-1 w-full md:w-auto shrink-0 select-none">
                <button
                  onClick={() => setProductCenterTab("details")}
                  className={`flex-1 md:flex-initial px-4 py-2 font-mono text-xs font-bold rounded-md transition ${
                    productCenterTab === "details"
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  📝 Product Details
                </button>
                <button
                  onClick={() => {
                    setIntelligenceInitialTab("analytics");
                    setProductCenterTab("intelligence");
                  }}
                  className={`flex-1 md:flex-initial px-4 py-2 font-mono text-xs font-bold rounded-md transition ${
                    productCenterTab === "intelligence"
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  🔬 Intelligence
                </button>
                <button
                  onClick={() => {
                    setIntelligenceInitialTab("history");
                    setProductCenterTab("history");
                  }}
                  className={`flex-1 md:flex-initial px-4 py-2 font-mono text-xs font-bold rounded-md transition ${
                    productCenterTab === "history"
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  📜 History versions
                </button>
                <button
                  onClick={() => setProductCenterTab("content")}
                  className={`flex-1 md:flex-initial px-4 py-2 font-mono text-xs font-bold rounded-md transition ${
                    productCenterTab === "content"
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  id="tab_selector_content"
                >
                  🎨 Content Studio
                </button>
                <button
                  onClick={() => setProductCenterTab("publishing")}
                  className={`flex-1 md:flex-initial px-4 py-2 font-mono text-xs font-bold rounded-md transition ${
                    productCenterTab === "publishing"
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  📣 Social Publishing
                </button>
                <button
                  onClick={() => setProductCenterTab("video")}
                  className={`flex-1 md:flex-initial px-4 py-2 font-mono text-xs font-bold rounded-md transition ${
                    productCenterTab === "video"
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  🎬 AI Video Studio
                </button>
              </div>
            </div>

            {/* Command-center view content */}
            <div className="min-h-[400px]">
              
              {/* TAB 1: PRODUCT DETAILS SANDBOX */}
              {productCenterTab === "details" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-8"
                >
                  {/* Left box: image, specs, variants */}
                  <div className="lg:col-span-8 flex flex-col gap-6">
                    <div className="bg-slate-950/60 border border-slate-800 p-6 rounded-xl shadow-lg flex flex-col md:flex-row gap-6">
                      <div className="flex flex-col gap-3 shrink-0 items-center md:items-start select-none">
                        <img
                          src={activeProductImage || selectedProductDetails.images}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="w-48 h-48 rounded-lg object-cover border border-slate-800 bg-slate-900 shrink-0 shadow-md transition-all duration-300"
                        />
                        {/* Gallery Thumbnails */}
                        {Array.isArray(selectedProductDetails.gallery) && selectedProductDetails.gallery.length > 0 && (
                          <div className="flex gap-2 p-1 overflow-x-auto max-w-[192px] scrollbar-none">
                            {selectedProductDetails.gallery.map((imgUrl, idx) => (
                              <button
                                key={idx}
                                onClick={() => setActiveProductImage(imgUrl)}
                                className={`w-10 h-10 rounded border overflow-hidden shrink-0 transition ${
                                  (activeProductImage || selectedProductDetails.images) === imgUrl
                                    ? "border-indigo-500 ring-1 ring-indigo-500"
                                    : "border-slate-800 hover:border-slate-700"
                                }`}
                              >
                                <img
                                  src={imgUrl}
                                  alt={`Product image ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col justify-between text-left">
                        <div>
                          <span className="text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded self-start inline-block">
                            Vendor: {selectedProductDetails.vendor}
                          </span>
                          <h3 className="text-xl font-extrabold text-slate-100 mt-2 mb-3 leading-snug">{selectedProductDetails.title}</h3>
                          <p className="text-xs text-slate-400 leading-relaxed font-sans max-h-36 overflow-y-auto pr-1">
                            {selectedProductDetails.description}
                          </p>
                        </div>
                        <div className="mt-4 border-t border-indigo-500/10 pt-3 flex flex-wrap items-center gap-6 font-mono text-xs text-slate-400">
                          <span>Base Price: <strong className="text-indigo-400 font-bold">{selectedProductDetails.currency} {selectedProductDetails.price}</strong></span>
                          <span>Availability: <strong className="text-emerald-400 font-bold">In stock</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Specification tags and dictionary */}
                    <div className="bg-slate-950/60 border border-slate-800 p-6 rounded-xl shadow-lg flex flex-col gap-3">
                      <h4 className="text-xs uppercase tracking-wider font-mono text-slate-300 border-b border-slate-900 pb-2 text-left font-bold select-none">Specification Metrics Dictionary</h4>
                      <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs text-slate-400 mt-1">
                        {Object.entries(selectedProductDetails.specifications || {}).length === 0 ? (
                          <div className="col-span-2 text-slate-500 text-left py-4">No specifications found on records.</div>
                        ) : (
                          Object.entries(selectedProductDetails.specifications || {}).map(([key, val]) => (
                            <div key={key} className="bg-slate-900/40 border border-slate-800/80 p-3 rounded-lg flex justify-between items-center text-xs">
                              <dt className="text-slate-400 font-semibold">{key}</dt>
                              <dd className="text-slate-200 text-right truncate max-w-44">{String(val)}</dd>
                            </div>
                          ))
                        )}
                      </dl>
                    </div>
                  </div>

                  {/* Right box: Variants, quick action bar */}
                  <div className="lg:col-span-4 flex flex-col gap-6">
                    
                    {/* Variants list */}
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-lg">
                      <div className="bg-slate-950 p-4 border-b border-slate-800/85">
                        <h4 className="text-xs font-mono uppercase tracking-wider text-slate-200 text-left font-bold select-none">Cataloged Variants ({selectedProductDetails.variants.length})</h4>
                      </div>
                      <div className="divide-y divide-slate-900/60 max-h-60 overflow-y-auto">
                        {selectedProductDetails.variants.length === 0 ? (
                          <div className="p-4 text-center text-slate-500 text-xs font-mono">No variants discovered</div>
                        ) : (
                          selectedProductDetails.variants.map((v) => (
                            <div key={v.id} className="p-3 text-xs bg-slate-950/40 flex items-center justify-between font-mono">
                              <span className="text-slate-300 truncate max-w-[200px]">{v.title}</span>
                              <span className="text-indigo-400 font-bold">{selectedProductDetails.currency} {v.price}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Direct quick intelligence CTA block */}
                    <div className="bg-gradient-to-br from-indigo-950/30 to-slate-955 border border-indigo-500/25 p-5 rounded-xl shadow-lg flex flex-col gap-4 text-left">
                      <div className="flex items-center gap-2 select-none text-white">
                        <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse animate-duration-1000" />
                        <div>
                          <strong className="text-xs text-slate-200 font-mono block uppercase">OPPORTUNITY AUDITING</strong>
                          <span className="text-[10px] text-slate-400 font-mono italic">Analyze opportunity limits</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 leading-normal font-sans">
                        Ready to extract Opportunity scores, localized customer objections refuted, viral short creative hooks & ugc dialog storyboards?
                      </p>
                      <button
                        onClick={() => setProductCenterTab("intelligence")}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold font-mono text-xs p-3 rounded-lg flex items-center justify-center gap-2 transition"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>Run Full Report</span>
                      </button>
                    </div>

                  </div>
                </motion.div>
              )}

              {/* TAB 2 & 3: LENT TO SYSTEM DETAILED INTELLIGENCE PANEL */}
              {(productCenterTab === "intelligence" || productCenterTab === "history") && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <IntelligenceDashboard
                    selectedProduct={selectedProductDetails}
                    workspaceId={workspaceId}
                    userCredits={workspace ? workspace.credits : 0}
                    onAnalysisSuccess={() => fetchData(workspaceId)}
                    initialTab={intelligenceInitialTab}
                  />
                </motion.div>
              )}

              {/* TAB 4: CONTENT STUDIO CAMPAIGNS PANEL */}
              {productCenterTab === "content" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <ContentStudio
                    selectedProduct={selectedProductDetails}
                    workspaceId={workspaceId}
                    userCredits={workspace ? workspace.credits : 0}
                    onOperationSuccess={() => fetchData(workspaceId)}
                  />
                </motion.div>
              )}

              {productCenterTab === "publishing" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <SocialPublishingCenter
                    selectedProduct={selectedProductDetails}
                    workspaceId={workspaceId}
                  />
                </motion.div>
              )}

              {productCenterTab === "video" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <VideoStudio
                    selectedProduct={selectedProductDetails}
                    workspaceId={workspaceId}
                  />
                </motion.div>
              )}

            </div>
          </motion.div>
        )}

      </AnimatePresence>

    </div>
  );
}