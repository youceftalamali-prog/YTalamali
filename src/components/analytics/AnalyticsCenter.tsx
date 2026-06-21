import React, { useMemo } from "react";
import { jsPDF } from "jspdf/dist/jspdf.es.min.js";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Target, TrendingUp, Users, Wallet } from "lucide-react";
import {
  AdvancedAnalyticsPayload,
  AnalyticsDatePreset,
  AnalyticsKpi,
  NormalizedProduct,
} from "../../types.ts";
import AnalyticsChartCard from "./AnalyticsChartCard.tsx";
import AnalyticsKpiCard from "./AnalyticsKpiCard.tsx";
import AnalyticsSection from "./AnalyticsSection.tsx";
import AnalyticsToolbar from "./AnalyticsToolbar.tsx";

interface AnalyticsCenterProps {
  analyticsData: AdvancedAnalyticsPayload | null;
  loading: boolean;
  selectedProduct: NormalizedProduct | null;
  preset: AnalyticsDatePreset;
  customStartDate: string;
  customEndDate: string;
  onPresetChange: (preset: AnalyticsDatePreset) => void;
  onCustomStartDateChange: (value: string) => void;
  onCustomEndDateChange: (value: string) => void;
}

const PIE_COLORS = ["#818cf8", "#22c55e", "#f59e0b", "#06b6d4", "#f43f5e"];

function formatMetric(value: number, format: AnalyticsKpi["format"]): string {
  if (format === "currency") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  }

  if (format === "percent") {
    return `${value.toFixed(1)}%`;
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function downloadBlob(blob: Blob, fileName: string): void {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

export default function AnalyticsCenter({
  analyticsData,
  loading,
  selectedProduct,
  preset,
  customStartDate,
  customEndDate,
  onPresetChange,
  onCustomStartDateChange,
  onCustomEndDateChange,
}: AnalyticsCenterProps) {
  const exportRows = useMemo(() => {
    if (!analyticsData) {
      return [];
    }

    return analyticsData.topProducts.map((product) => ({
      title: product.title,
      vendor: product.vendor,
      revenue: product.revenue,
      conversions: product.conversions,
      traffic: product.traffic,
      engagementRate: product.engagementRate,
      roi: product.roi,
      opportunityScore: product.opportunityScore,
    }));
  }, [analyticsData]);

  const handleExport = (format: "csv" | "excel" | "pdf") => {
    if (!analyticsData) {
      return;
    }

    const baseName = `analytics-${analyticsData.dateRange.preset}-${analyticsData.dateRange.startDate.slice(0, 10)}`;

    if (format === "csv") {
      const header = "Title,Vendor,Revenue,Conversions,Traffic,Engagement Rate,ROI,Opportunity Score";
      const rows = exportRows.map((row) =>
        [
          row.title,
          row.vendor,
          row.revenue,
          row.conversions,
          row.traffic,
          row.engagementRate,
          row.roi,
          row.opportunityScore,
        ].join(",")
      );
      downloadBlob(new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" }), `${baseName}.csv`);
      return;
    }

    if (format === "excel") {
      const tableRows = exportRows
        .map((row) => `
          <tr>
            <td>${row.title}</td>
            <td>${row.vendor}</td>
            <td>${row.revenue}</td>
            <td>${row.conversions}</td>
            <td>${row.traffic}</td>
            <td>${row.engagementRate}</td>
            <td>${row.roi}</td>
            <td>${row.opportunityScore}</td>
          </tr>
        `)
        .join("");
      const workbook = `
        <html>
          <head><meta charset="UTF-8" /></head>
          <body>
            <table border="1">
              <tr>
                <th>Title</th>
                <th>Vendor</th>
                <th>Revenue</th>
                <th>Conversions</th>
                <th>Traffic</th>
                <th>Engagement Rate</th>
                <th>ROI</th>
                <th>Opportunity Score</th>
              </tr>
              ${tableRows}
            </table>
          </body>
        </html>
      `;
      downloadBlob(new Blob([workbook], { type: "application/vnd.ms-excel" }), `${baseName}.xls`);
      return;
    }

    const doc = new jsPDF();
    let cursorY = 18;
    doc.setFontSize(16);
    doc.text("AuraPost Advanced Analytics", 14, cursorY);
    cursorY += 8;
    doc.setFontSize(10);
    doc.text(`Range: ${analyticsData.dateRange.label}`, 14, cursorY);
    if (selectedProduct) {
      cursorY += 6;
      doc.text(`Selected Product: ${selectedProduct.title}`, 14, cursorY);
    }
    cursorY += 10;

    analyticsData.kpis.slice(0, 6).forEach((item) => {
      doc.text(`${item.label}: ${formatMetric(item.value, item.format)} (${item.change.toFixed(1)}%)`, 14, cursorY);
      cursorY += 6;
    });

    cursorY += 4;
    doc.text("Top Performing Products", 14, cursorY);
    cursorY += 8;

    exportRows.slice(0, 6).forEach((row) => {
      doc.text(
        `${row.title} | Revenue ${row.revenue.toFixed(0)} | Conv ${row.conversions} | ROI ${row.roi.toFixed(1)}%`,
        14,
        cursorY
      );
      cursorY += 6;
    });

    downloadBlob(doc.output("blob"), `${baseName}.pdf`);
  };

  if (!analyticsData) {
    return (
      <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-8 text-center text-slate-400 text-sm">
        Analytics data will appear after the dashboard loads a valid workspace payload.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <AnalyticsToolbar
        preset={preset}
        customStartDate={customStartDate}
        customEndDate={customEndDate}
        loading={loading}
        onPresetChange={onPresetChange}
        onCustomStartDateChange={onCustomStartDateChange}
        onCustomEndDateChange={onCustomEndDateChange}
        onExport={handleExport}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {analyticsData.kpis.map((item) => (
          <AnalyticsKpiCard key={item.id} item={item} />
        ))}
      </div>

      <AnalyticsSection
        title="Sales Analytics"
        description={`Track estimated order flow, repeat customer behavior, and sell-through performance for ${analyticsData.dateRange.label.toLowerCase()}.`}
      >
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <AnalyticsChartCard
            title="Revenue Trends"
            description="Daily revenue and growth movement across the selected date range."
            actions={<span className="text-[11px] font-mono text-slate-500">{analyticsData.dateRange.label}</span>}
          >
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={analyticsData.revenueTrend}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" stroke="#818cf8" fill="url(#revenueGradient)" strokeWidth={2} />
                <Line type="monotone" dataKey="growth" stroke="#22c55e" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </AnalyticsChartCard>

          <AnalyticsChartCard
            title="Sales KPIs"
            description="Core sales and order efficiency metrics."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-2">
                <Users className="w-5 h-5 text-indigo-300" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Total Sales</span>
                <strong className="text-2xl text-white">{analyticsData.salesAnalytics.totalSales}</strong>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-2">
                <Wallet className="w-5 h-5 text-emerald-300" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Average Order Value</span>
                <strong className="text-2xl text-white">${analyticsData.salesAnalytics.averageOrderValue.toFixed(0)}</strong>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-2">
                <TrendingUp className="w-5 h-5 text-amber-300" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Repeat Customers</span>
                <strong className="text-2xl text-white">{analyticsData.salesAnalytics.repeatCustomers}</strong>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-2">
                <Target className="w-5 h-5 text-rose-300" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Sell-Through Rate</span>
                <strong className="text-2xl text-white">{analyticsData.salesAnalytics.sellThroughRate.toFixed(1)}%</strong>
              </div>
            </div>
          </AnalyticsChartCard>

          <AnalyticsChartCard
            title="Revenue Analytics"
            description="Gross revenue, net revenue, ROI, and growth trends."
          >
            <div className="grid grid-cols-1 gap-4 h-full">
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <span className="text-sm text-slate-300">Gross Revenue</span>
                <strong className="text-white text-xl">${analyticsData.revenueAnalytics.grossRevenue.toFixed(0)}</strong>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <span className="text-sm text-slate-300">Net Revenue</span>
                <strong className="text-white text-xl">${analyticsData.revenueAnalytics.netRevenue.toFixed(0)}</strong>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <span className="text-sm text-slate-300">ROI</span>
                <strong className="text-white text-xl">{analyticsData.revenueAnalytics.roi.toFixed(1)}%</strong>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <span className="text-sm text-slate-300">Growth Trend</span>
                <strong className="text-white text-xl">{analyticsData.revenueAnalytics.growthRate.toFixed(1)}%</strong>
              </div>
            </div>
          </AnalyticsChartCard>
        </div>
      </AnalyticsSection>

      <AnalyticsSection
        title="Conversion Analytics"
        description="Monitor conversion flow, checkout efficiency, and customer engagement quality."
      >
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <AnalyticsChartCard
            title="Conversion Rates"
            description="Daily conversion, traffic, and engagement movement."
          >
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={analyticsData.revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" stroke="#64748b" />
                <YAxis yAxisId="left" stroke="#64748b" />
                <YAxis yAxisId="right" orientation="right" stroke="#64748b" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="conversions" stroke="#22c55e" strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="engagement" stroke="#06b6d4" strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="traffic" stroke="#818cf8" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </AnalyticsChartCard>

          <AnalyticsChartCard
            title="Conversion KPIs"
            description="Checkout funnel and lead capture metrics."
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Conversion Rate</span>
                <p className="text-2xl font-bold text-white mt-2">{analyticsData.conversionAnalytics.conversionRate.toFixed(1)}%</p>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Cart to Checkout</span>
                <p className="text-2xl font-bold text-white mt-2">{analyticsData.conversionAnalytics.cartToCheckoutRate.toFixed(1)}%</p>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Checkout to Purchase</span>
                <p className="text-2xl font-bold text-white mt-2">{analyticsData.conversionAnalytics.checkoutToPurchaseRate.toFixed(1)}%</p>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Leads Captured</span>
                <p className="text-2xl font-bold text-white mt-2">{analyticsData.conversionAnalytics.leadsCaptured}</p>
              </div>
            </div>
          </AnalyticsChartCard>
        </div>
      </AnalyticsSection>

      <AnalyticsSection
        title="Traffic Analytics"
        description="Inspect traffic channels, visitor quality, and growth trends."
      >
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <AnalyticsChartCard
            title="Traffic Sources"
            description="Channel mix across paid, organic, social, email, and referral traffic."
          >
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={analyticsData.trafficSources} dataKey="value" nameKey="label" outerRadius={100} label>
                  {analyticsData.trafficSources.map((entry, index) => (
                    <Cell key={entry.label} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </AnalyticsChartCard>

          <AnalyticsChartCard
            title="Traffic KPIs"
            description="Visitor quality and session efficiency."
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Sessions</span>
                <p className="text-2xl font-bold text-white mt-2">{analyticsData.trafficAnalytics.sessions}</p>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Unique Visitors</span>
                <p className="text-2xl font-bold text-white mt-2">{analyticsData.trafficAnalytics.uniqueVisitors}</p>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Returning Visitors</span>
                <p className="text-2xl font-bold text-white mt-2">{analyticsData.trafficAnalytics.returningVisitors}</p>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Bounce Rate</span>
                <p className="text-2xl font-bold text-white mt-2">{analyticsData.trafficAnalytics.bounceRate.toFixed(1)}%</p>
              </div>
            </div>
          </AnalyticsChartCard>
        </div>
      </AnalyticsSection>

      <AnalyticsSection
        title="Product Performance Analytics"
        description="Identify top-performing products by revenue, traffic, ROI, and AI opportunity score."
      >
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <AnalyticsChartCard
            title="Top Performing Products"
            description="Revenue ranking for the strongest catalog performers."
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={analyticsData.topProducts}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="title" stroke="#64748b" hide />
                <YAxis stroke="#64748b" />
                <Tooltip />
                <Bar dataKey="revenue" fill="#818cf8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </AnalyticsChartCard>

          <AnalyticsChartCard
            title="Product Scoreboard"
            description="Top products across revenue, conversions, traffic, and ROI."
          >
            <div className="flex flex-col gap-3 max-h-[260px] overflow-y-auto pr-1">
              {analyticsData.productPerformanceAnalytics.topPerformers.map((product) => (
                <div key={product.productId} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="col-span-2">
                    <p className="text-slate-100 font-semibold">{product.title}</p>
                    <p className="text-slate-500 mt-1">{product.vendor}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 uppercase font-mono text-[10px]">Revenue</p>
                    <p className="text-white mt-1">${product.revenue.toFixed(0)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 uppercase font-mono text-[10px]">ROI</p>
                    <p className="text-white mt-1">{product.roi.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-slate-500 uppercase font-mono text-[10px]">Traffic</p>
                    <p className="text-white mt-1">{product.traffic}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 uppercase font-mono text-[10px]">Engagement</p>
                    <p className="text-white mt-1">{product.engagementRate.toFixed(1)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </AnalyticsChartCard>
        </div>
      </AnalyticsSection>

      <AnalyticsSection
        title="Competitor Analytics"
        description="Track competitor threat levels, whitespace opportunities, and differentiation pressure."
      >
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <AnalyticsChartCard
            title="Competitor Threat Matrix"
            description="Threat versus whitespace scores from Brand Intelligence."
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={analyticsData.competitorAnalytics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="competitorName" stroke="#64748b" hide />
                <YAxis stroke="#64748b" />
                <Tooltip />
                <Legend />
                <Bar dataKey="threatScore" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                <Bar dataKey="whitespaceScore" fill="#22c55e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </AnalyticsChartCard>

          <AnalyticsChartCard
            title="Competitor Summary"
            description="Qualitative competitor positioning and tone tracking."
          >
            <div className="grid grid-cols-1 gap-3 max-h-[260px] overflow-y-auto pr-1">
              {analyticsData.competitorAnalytics.map((competitor) => (
                <div key={competitor.competitorName} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-slate-100 font-semibold">{competitor.competitorName}</p>
                    <span className="text-[10px] uppercase font-mono text-indigo-300">{competitor.toneOfVoice || "No tone"}</span>
                  </div>
                  <p className="text-slate-400 text-xs mt-2">{competitor.positioning}</p>
                  <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                    <div>
                      <span className="text-slate-500 uppercase font-mono text-[10px]">Threat</span>
                      <p className="text-white mt-1">{competitor.threatScore}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 uppercase font-mono text-[10px]">Whitespace</span>
                      <p className="text-white mt-1">{competitor.whitespaceScore}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </AnalyticsChartCard>
        </div>
      </AnalyticsSection>

      <AnalyticsSection
        title="Social Media Analytics"
        description="Monitor customer engagement metrics, social traction, and creative resonance."
      >
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <AnalyticsChartCard
            title="Customer Engagement Metrics"
            description="Daily engagement and ROI movement driven by AI-generated content."
          >
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={analyticsData.revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="engagement" stroke="#06b6d4" strokeWidth={2} />
                <Line type="monotone" dataKey="roi" stroke="#f59e0b" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </AnalyticsChartCard>

          <AnalyticsChartCard
            title="Social Highlights"
            description="Top hook-led product moments across the selected period."
          >
            <div className="grid grid-cols-1 gap-3 max-h-[260px] overflow-y-auto pr-1">
              {analyticsData.socialMediaAnalytics.map((item) => (
                <div key={item.title} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-slate-100 font-semibold">{item.title}</p>
                    <span className="text-xs font-mono text-indigo-300">{item.metric}</span>
                  </div>
                  <p className="text-slate-400 text-xs mt-2 leading-relaxed">{item.detail}</p>
                </div>
              ))}
            </div>
          </AnalyticsChartCard>
        </div>
      </AnalyticsSection>

      <AnalyticsSection
        title="AI Opportunity Score Analytics"
        description="Track AI opportunity movement and identify the best growth-ready products."
      >
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <AnalyticsChartCard
            title="Opportunity & Growth Trends"
            description="Opportunity scores overlaid with growth trajectory."
          >
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={analyticsData.revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="opportunity" stroke="#818cf8" strokeWidth={2} />
                <Line type="monotone" dataKey="growth" stroke="#22c55e" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </AnalyticsChartCard>

          <AnalyticsChartCard
            title="Opportunity Recommendations"
            description="Actionable recommendations based on AI opportunity and confidence scores."
          >
            <div className="flex flex-col gap-3 max-h-[260px] overflow-y-auto pr-1">
              {analyticsData.opportunityAnalytics.map((item) => (
                <div key={item.productId} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-slate-100 font-semibold">{item.title}</p>
                    <span className="text-xs font-mono text-indigo-300">{item.overall}</span>
                  </div>
                  <p className="text-slate-400 text-xs mt-2">{item.recommendation}</p>
                  <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                    <div>
                      <span className="text-slate-500 uppercase font-mono text-[10px]">Demand</span>
                      <p className="text-white mt-1">{item.demand}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 uppercase font-mono text-[10px]">Trend</span>
                      <p className="text-white mt-1">{item.trend}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 uppercase font-mono text-[10px]">Profitability</span>
                      <p className="text-white mt-1">{item.profitability}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 uppercase font-mono text-[10px]">Confidence</span>
                      <p className="text-white mt-1">{item.confidence.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </AnalyticsChartCard>
        </div>
      </AnalyticsSection>
    </div>
  );
}
