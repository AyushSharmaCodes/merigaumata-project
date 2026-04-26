import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/shared/components/ui/card";
import {
  BarChart,
  Bar,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardMessages } from "@/shared/constants/messages/DashboardMessages";

type DashboardChartsSectionProps = {
  stats?: any;
  charts?: any;
  isFetchingCharts?: boolean;
  revenueTimeframe: string;
  onRevenueTimeframeChange: (value: "weekly" | "monthly" | "yearly") => void;
  orderSummaryTimeframe: string;
  onOrderSummaryTimeframeChange: (value: "weekly" | "monthly" | "yearly") => void;
  categoryTimeframe: string;
  onCategoryTimeframeChange: (value: "weekly" | "monthly" | "yearly") => void;
};

const TIMEFRAME_OPTIONS = ["weekly", "monthly", "yearly"] as const;

function TimeframePills({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: "weekly" | "monthly" | "yearly") => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {TIMEFRAME_OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
            value === option
              ? "bg-primary text-white shadow-lg shadow-primary/20"
              : "bg-[#F9F5F0] text-[#2C1810] hover:bg-[#F1E7DD]"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

const CustomBar = memo((props: any) => {
  const { fill, x, y, width, height } = props;
  if (height <= 0) return null;

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} rx={2} />
      <rect x={x} y={y} width={width} height={Math.min(height, height ? 6 : 0)} fill="#F9F5F0" fillOpacity={0.4} rx={1} />
    </g>
  );
});

CustomBar.displayName = "CustomBar";

export const DashboardChartsSection = memo(({
  stats,
  charts,
  isFetchingCharts,
  revenueTimeframe,
  onRevenueTimeframeChange,
  orderSummaryTimeframe,
  onOrderSummaryTimeframeChange,
  categoryTimeframe,
  onCategoryTimeframeChange,
}: DashboardChartsSectionProps) => {
  const { t } = useTranslation();

  return (
    <div className="grid gap-6 lg:grid-cols-12 animate-in fade-in duration-700">
      <Card className="lg:col-span-8 border-none shadow-sm bg-white/50 backdrop-blur-sm relative">
        {isFetchingCharts && (
          <div className="absolute top-4 right-4 z-10 h-2 w-2 animate-pulse rounded-full bg-primary" />
        )}
        <CardContent className="p-8">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h3 className="text-lg font-bold text-[#2C1810]">{t(DashboardMessages.REVENUE_GROWTH)}</h3>
            <TimeframePills value={revenueTimeframe} onChange={onRevenueTimeframeChange} />
          </div>

          <div className="mb-10 flex gap-8 overflow-x-auto pb-2 scrollbar-none">
            <div className="flex min-w-max flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-[#B85C3C]" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t(DashboardMessages.REVENUE)}</span>
              </div>
              <span className="text-xl font-bold text-[#2C1810]">{t("common.currency")}{stats?.totalEarnings?.toLocaleString() || "0"}</span>
            </div>
            <div className="flex min-w-max flex-col gap-1 border-l border-border/50 pl-8">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-[#8E7CC3]" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("admin.dashboard.stats.newOrders", "New Orders")}</span>
              </div>
              <span className="text-xl font-bold text-[#2C1810]">{stats?.newOrdersCount || 0}</span>
            </div>
            <div className="flex min-w-max flex-col gap-1 border-l border-border/50 pl-8">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-[#E8A855]" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t(DashboardMessages.TOTAL_DONATIONS)}</span>
              </div>
              <span className="text-xl font-bold text-[#2C1810]">{t("common.currency")}{stats?.totalDonations?.toLocaleString() || "0"}</span>
            </div>
          </div>

          <div className="mt-4 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={charts?.revenueTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700, fill: "#64748b" }}
                  dy={12}
                />
                <YAxis hide />
                <YAxis yAxisId="orders" hide />
                <Tooltip
                  cursor={{ fill: "rgba(184, 92, 60, 0.03)" }}
                  contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 8px 16px rgba(0,0,0,0.08)", fontSize: "10px", fontWeight: "bold" }}
                />
                <Bar dataKey="revenue" fill="#B85C3C" barSize={36} shape={<CustomBar />} animationDuration={1000} />
                <Line type="monotone" dataKey="orders" yAxisId="orders" stroke="#8E7CC3" strokeWidth={4} dot={false} animationDuration={1500} />
                <Line type="monotone" dataKey="donations" stroke="#E8A855" strokeWidth={4} strokeDasharray="6 6" dot={false} animationDuration={2000} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-4 border-none shadow-sm bg-white/50 backdrop-blur-sm relative">
        {isFetchingCharts && (
          <div className="absolute top-4 right-4 z-10 h-2 w-2 animate-pulse rounded-full bg-primary" />
        )}
        <CardContent className="flex h-full flex-col p-6">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h3 className="text-lg font-bold text-[#2C1810]">{t(DashboardMessages.ORDER_DISTRIBUTION)}</h3>
            <TimeframePills value={orderSummaryTimeframe} onChange={onOrderSummaryTimeframeChange} />
          </div>

          <div className="relative min-h-[240px] flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts?.orderStatusDistribution}
                  innerRadius={75}
                  outerRadius={95}
                  paddingAngle={10}
                  dataKey="value"
                  animationDuration={1500}
                  stroke="none"
                >
                  {charts?.orderStatusDistribution?.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] font-bold uppercase tracking-widest leading-none text-muted-foreground">{t(DashboardMessages.ACTIVITY)}</span>
              <span className="mt-2 text-4xl font-black leading-none text-[#2C1810]">{stats?.newOrdersCount || 0}</span>
            </div>
          </div>

          <div className="mt-8 grid gap-4">
            {charts?.orderStatusDistribution?.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between rounded-xl border border-border/30 bg-background/50 p-3 transition-colors hover:bg-background">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t(`common.order.status.${item.name.toLowerCase()}`, item.name) as string}</span>
                </div>
                <span className="text-sm font-black text-[#2C1810]">{item.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="lg:col-span-4 lg:col-start-9">
        <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm relative">
          {isFetchingCharts && (
            <div className="absolute top-4 right-4 z-10 h-2 w-2 animate-pulse rounded-full bg-primary" />
          )}
          <CardContent className="p-6">
            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h3 className="text-lg font-bold text-[#2C1810]">{t(DashboardMessages.SALE_BY_CATEGORY)}</h3>
              <TimeframePills value={categoryTimeframe} onChange={onCategoryTimeframeChange} />
            </div>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts?.categoryStats} layout="vertical" margin={{ left: 20, right: 30, top: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="category"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fontWeight: 800, fill: "#2C1810" }}
                    width={140}
                    interval={0}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(0,0,0,0.02)" }}
                    contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", fontSize: "10px", fontWeight: "bold" }}
                    formatter={(value: any) => [`${value} Units`, "Quantity Sold"]}
                  />
                  <Bar dataKey="count" fill="#B85C3C" radius={[0, 6, 6, 0]} barSize={16} animationDuration={2000}>
                    {charts?.categoryStats?.map((entry: any, index: number) => (
                      <Cell key={`category-cell-${index}`} fill={entry.count > 0 ? "#B85C3C" : "#E5E7EB"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

DashboardChartsSection.displayName = "DashboardChartsSection";

export default DashboardChartsSection;
