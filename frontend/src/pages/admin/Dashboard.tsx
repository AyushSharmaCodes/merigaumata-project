import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ShoppingCart, Users, Heart, Shield, 
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown,
  Download, ChevronDown, MessageSquare
} from 'lucide-react';
import { format } from 'date-fns';
import { analyticsService } from '@/services/analytics.service';
import { useAuthStore } from '@/store/authStore';
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from 'lucide-react';
import React, { lazy, memo, Suspense } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// --- Custom Components ---
import { DashboardAlerts } from '@/components/admin/DashboardAlerts';
import { DashboardMessages } from '@/constants/messages/DashboardMessages';
import { 
  DashboardStatSkeleton, 
  DashboardChartSkeleton, 
  OrderActivitySkeleton 
} from '@/components/ui/page-skeletons';

const DashboardChartsSection = lazy(() => import('@/components/admin/DashboardChartsSection'));

const TimeframeSelector = memo(({ value, onChange, options = ['weekly', 'monthly', 'yearly'] }: any) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="bg-[#F9F5F0] border-none text-[10px] font-bold uppercase tracking-widest rounded-xl gap-2 h-9 px-4 capitalize">
          {value} <ChevronDown className="h-3.5 w-3.5 opacity-50 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl border-none shadow-2xl p-2 bg-white/95 backdrop-blur-md min-w-[120px]">
        {options.map((opt: string) => (
          <DropdownMenuItem 
            key={opt} 
            onClick={() => onChange(opt)} 
            className="text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-black/5 cursor-pointer py-2 px-4 transition-colors"
          >
            {opt}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

TimeframeSelector.displayName = 'TimeframeSelector';

const SparklineBars = memo(({ data = [], color }: { data?: Array<{ value?: number }>, color: string }) => {
  const safeData = Array.isArray(data) ? data : [];
  const maxValue = safeData.reduce((max, point) => Math.max(max, Number(point?.value || 0)), 0) || 1;

  return (
    <div className="flex h-full items-end gap-[3px] px-1">
      {safeData.map((point, index) => {
        const value = Math.max(0, Number(point?.value || 0));
        const height = Math.max(6, Math.round((value / maxValue) * 100));

        return (
          <div
            key={index}
            className="flex-1 rounded-t-[2px] transition-all duration-500"
            style={{
              height: `${height}%`,
              backgroundColor: color,
              opacity: 0.3,
            }}
          />
        );
      })}
    </div>
  );
});

SparklineBars.displayName = 'SparklineBars';

const StatCard = memo(({ title, value, trendIcon: TrendIcon = TrendingUp, trendValue, icon: Icon, data, color, isUpdating }: any) => {
  return (
    <Card className="border-none shadow-sm bg-white overflow-hidden transition-all duration-500 hover:shadow-xl hover:-translate-y-1">
      <CardContent className="p-5">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-5">
            <div 
              className="w-12 h-12 flex items-center justify-center relative flex-shrink-0 rounded-full"
              style={{
                backgroundColor: `${color}15`,
                boxShadow: `0 4px 12px -2px ${color}20`
              }}
            >
              <div 
                className="w-9 h-9 flex items-center justify-center rounded-full relative"
                style={{ backgroundColor: color }}
              >
                <Icon className="h-4 w-4 text-white" />
                {isUpdating && (
                  <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-white rounded-full border-2 border-primary animate-pulse" />
                )}
              </div>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">
                  {title}
                </span>
                <div className="flex items-center gap-0.5">
                  <TrendIcon className="h-3 w-3" style={{ color: color }} />
                  <span className="text-[9px] font-black leading-none" style={{ color: '#2C1810' }}>
                    {trendValue}
                  </span>
                </div>
              </div>
              <h3 className="text-xl font-black mt-1 leading-none text-[#2C1810] tracking-tight">
                {value}
              </h3>
            </div>
          </div>
        </div>

        <div className="h-16 mt-6 -mx-1 -mb-1">
          <SparklineBars data={data} color={color} />
        </div>
      </CardContent>
    </Card>
  );
});

StatCard.displayName = 'StatCard';

export default function AdminDashboard() {
  const { t } = useTranslation();
  const user = useAuthStore(state => state.user);
  const chartsSectionRef = useRef<HTMLDivElement | null>(null);
  const [shouldRenderChartsSection, setShouldRenderChartsSection] = useState(false);
  const [ordersPage, setOrdersPage] = useState(1);
  const [summaryTimeframe, setSummaryTimeframe] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');
  const [revenueTimeframe, setRevenueTimeframe] = useState<'weekly' | 'monthly' | 'yearly'>('yearly');
  const [orderSummaryTimeframe, setOrderSummaryTimeframe] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [categoryTimeframe, setCategoryTimeframe] = useState<'weekly' | 'monthly' | 'yearly'>('yearly');
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();
  const ordersLimit = 10;

  // 1. Dashboard Summary (KPIs & Sparklines) - Frequent Polling (30s)
  const { data: summaryData, isFetching: isFetchingSummary, isLoading: isLoadingSummary } = useQuery({
    queryKey: ['admin-dashboard-summary', summaryTimeframe],
    queryFn: () => analyticsService.getDashboardStats({ 
      scope: 'summary',
      summaryTimeframe
    }),
    placeholderData: keepPreviousData,
    staleTime: 30000,
    refetchInterval: 30000
  });

  // 2. Dashboard Charts (Revenue, Dist, Categories) - Poll on change only
  const { data: chartsData, isFetching: isFetchingCharts, isLoading: isLoadingCharts } = useQuery({
    queryKey: ['admin-dashboard-charts', revenueTimeframe, orderSummaryTimeframe, categoryTimeframe],
    queryFn: () => analyticsService.getDashboardStats({ 
      scope: 'charts',
      revenueTimeframe,
      orderSummaryTimeframe,
      categoryTimeframe
    }),
    placeholderData: keepPreviousData,
    staleTime: 300000 // 5 minutes (rarely changes fast enough to poll)
  });

  // 3. Dashboard Activity (Recent Orders, Comments, Events) - Less Frequent Polling (90s)
  const { data: activityData, isFetching: isFetchingActivity, isLoading: isLoadingActivity } = useQuery({
    queryKey: ['admin-dashboard-activity', ordersPage],
    queryFn: () => analyticsService.getDashboardStats({ 
      scope: 'activity',
      ordersPage,
      ordersLimit
    }),
    placeholderData: keepPreviousData,
    staleTime: 90000,
    refetchInterval: 90000
  });

  const s = summaryData?.stats;
  const c = chartsData?.charts;
  const recentOrders = activityData?.recentOrders?.data || [];
  const pagination = activityData?.recentOrders?.pagination;
  const recentComments = activityData?.recentComments || [];

  useEffect(() => {
    if (shouldRenderChartsSection) return;

    const target = chartsSectionRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') {
      setShouldRenderChartsSection(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setShouldRenderChartsSection(true);
        observer.disconnect();
      },
      { rootMargin: '240px 0px' }
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [shouldRenderChartsSection]);

  
  const handleExport = async () => {
    try {
      setIsExporting(true);
      const csvBlob = await analyticsService.exportAnalysis({
        summaryTimeframe,
        revenueTimeframe,
        orderSummaryTimeframe,
        categoryTimeframe
      });
      
      const url = window.URL.createObjectURL(csvBlob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `platform-analysis-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: t("admin.dashboard.toasts.exportSuccess"),
        description: t("admin.dashboard.toasts.exportSuccessDesc"),
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: t("admin.dashboard.toasts.exportFailed"),
        description: t("admin.dashboard.toasts.exportFailedDesc"),
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 py-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#2C1810]">{t(DashboardMessages.PLATFORM_OVERVIEW)}</h1>
          <p className="text-muted-foreground mt-0.5 text-xs font-medium italic">{t(DashboardMessages.OBSERVE_STATS)}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            disabled={isExporting}
            onClick={handleExport}
            className="h-10 px-6 rounded-xl bg-primary hover:bg-primary-hover shadow-md shadow-primary/20 text-xs font-bold uppercase tracking-widest gap-2"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {isExporting ? t("admin.dashboard.actions.exporting") : t("admin.dashboard.actions.exportAnalysis")}
          </Button>
        </div>
      </div>

      {/* Dashboard Alerts */}
      <DashboardAlerts />

      {/* Stats Section Header */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#B85C3C]">{t(DashboardMessages.REAL_TIME_METRICS)}</h2>
        <TimeframeSelector value={summaryTimeframe} onChange={setSummaryTimeframe} />
      </div>

      {isLoadingSummary ? (
        <DashboardStatSkeleton />
      ) : (
        /* 5 KPI Cards Grid */
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 animate-in fade-in duration-700">
          <StatCard 
            title={t(DashboardMessages.TOTAL_ORDERS)} 
            value={s?.totalOrders?.toLocaleString() || '0'} 
            trendIcon={TrendingUp} 
            trendValue={`+${s?.newOrdersCount || 0}`} 
            icon={ShoppingCart}
            data={s?.sparklineData?.orders}
            color="#2563EB" 
            isUpdating={isFetchingSummary}
          />
          <StatCard 
            title={t(DashboardMessages.TOTAL_EARNINGS)} 
            value={`${t('common.currency')}${s?.totalEarnings?.toLocaleString() || '0'}`} 
            trendIcon={TrendingUp} 
            trendValue="Live" 
            icon={TrendingUp}
            data={s?.sparklineData?.earnings}
            color="#FF7849" 
            isUpdating={isFetchingSummary}
          />
          <StatCard 
            title={t(DashboardMessages.TOTAL_DONATIONS)} 
            value={`${t('common.currency')}${s?.totalDonations?.toLocaleString() || '0'}`} 
            trendIcon={TrendingUp} 
            trendValue={`+${s?.newDonationsAmount || 0}`} 
            icon={Heart}
            data={s?.sparklineData?.donations}
            color="#E8A855" 
            isUpdating={isFetchingSummary}
          />
          <StatCard 
            title={t(DashboardMessages.TOTAL_CUSTOMERS)} 
            value={s?.totalCustomers?.toLocaleString() || '0'} 
            trendIcon={TrendingUp} 
            trendValue={`+${s?.newCustomersCount || 0}`} 
            icon={Users}
            data={s?.sparklineData?.customers}
            color="#9D7ECB" 
            isUpdating={isFetchingSummary}
          />
          <StatCard 
            title={t(DashboardMessages.TOTAL_MANAGERS)} 
            value={s?.totalManagers?.toLocaleString() || '0'} 
            trendIcon={Shield} 
            trendValue="Verified" 
            icon={Shield}
            data={s?.sparklineData?.managers}
            color="#568F56" 
            isUpdating={isFetchingSummary}
          />
        </div>
      )}

      <div ref={chartsSectionRef}>
        {isLoadingCharts && !shouldRenderChartsSection ? (
          <DashboardChartSkeleton />
        ) : shouldRenderChartsSection ? (
          <Suspense fallback={<DashboardChartSkeleton />}>
            <DashboardChartsSection
              stats={s}
              charts={c}
              isFetchingCharts={isFetchingCharts}
              revenueTimeframe={revenueTimeframe}
              onRevenueTimeframeChange={setRevenueTimeframe}
              orderSummaryTimeframe={orderSummaryTimeframe}
              onOrderSummaryTimeframeChange={setOrderSummaryTimeframe}
              categoryTimeframe={categoryTimeframe}
              onCategoryTimeframeChange={setCategoryTimeframe}
            />
          </Suspense>
        ) : (
          <div className="rounded-[32px] border border-dashed border-border/60 bg-white/50 px-8 py-12 text-center">
            <p className="text-sm font-bold text-[#2C1810]">
              {t("admin.dashboard.loadingDeferred.title", "Charts will load as you continue down the dashboard")}
            </p>
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              {t("admin.dashboard.loadingDeferred.description", "We are keeping the first dashboard paint lighter by deferring chart libraries until this section is near view.")}
            </p>
          </div>
        )}
      </div>

      {isLoadingActivity ? (
        <OrderActivitySkeleton />
      ) : (
        /* Tables Row */
        <div className="grid gap-6 lg:grid-cols-12 animate-in fade-in duration-700">
          {/* Recent Orders */}
          <Card className="lg:col-span-8 border-none shadow-sm bg-white/50 backdrop-blur-sm overflow-hidden relative">
            {isFetchingActivity && (
              <div className="absolute top-4 right-8 z-10 w-2 h-2 bg-primary rounded-full animate-pulse" />
            )}
            <div className="p-6 pb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#2C1810]">{t(DashboardMessages.RECENT_ORDERS)}</h3>
              <Button variant="ghost" className="text-[10px] font-bold uppercase tracking-widest text-[#B85C3C] gap-2 hover:bg-[#B85C3C]/5 group">
                {t(DashboardMessages.VIEW_ALL)} <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>
            <div className="px-1">
              <Table>
                <TableHeader>
                  <TableRow className="border-none hover:bg-transparent bg-[#F9F5F0]/70">
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest pl-8 text-[#2C1810]">{t(DashboardMessages.ORDER_ID)}</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-[#2C1810]">{t(DashboardMessages.CUSTOMER)}</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-[#2C1810]">{t(DashboardMessages.STATUS)}</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-right pr-8 text-[#2C1810]">{t(DashboardMessages.AMOUNT)}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders.map((order: any) => (
                    <TableRow key={order.id} className="border-none hover:bg-white transition-all cursor-pointer group">
                      <TableCell className="py-5 pl-8">
                        <span className="text-xs font-bold tracking-wider opacity-60 group-hover:opacity-100 transition-opacity">#{order.orderNumber}</span>
                      </TableCell>
                      <TableCell className="py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-background border border-border/50 flex items-center justify-center text-[10px] font-bold text-[#B85C3C]">
                            {order.customerName?.charAt(0) || '?'}
                          </div>
                          <span className="text-xs font-bold text-[#2C1810]">{order.customerName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-5">
                        <Badge variant="secondary" className={`text-[9px] font-bold uppercase tracking-widest px-2.5 h-6 border-none shadow-sm ${
                          order.status === 'delivered' || order.status === 'completed' ? 'bg-secondary/10 text-secondary' :
                          order.status === 'pending' || order.status === 'processing' ? 'bg-[#B85C3C]/10 text-[#B85C3C]' : 'bg-muted text-muted-foreground'
                        }`}>
                          {t(`common.order.status.${order.status.toLowerCase()}`, order.status) as string}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-5 text-right pr-8">
                        <span className="text-xs font-black tracking-widest text-[#2C1810]">{t('common.currency')}{order.amount?.toLocaleString() || '0'}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination */}
            <div className="p-8 py-6 border-t border-border/20 flex items-center justify-between bg-white/30">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                {t("common.pagination.showing", "Showing")} {((ordersPage - 1) * ordersLimit) + 1}-{Math.min(ordersPage * ordersLimit, pagination?.total || 0)} {t("common.pagination.of", "of")} {pagination?.total || 0}
              </p>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-9 w-9 rounded-xl bg-white/70 border-none shadow-sm disabled:opacity-30 hover:bg-white transition-all"
                  onClick={() => setOrdersPage(p => Math.max(1, p - 1))}
                  disabled={ordersPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1.5 mx-1">
                  {Array.from({ length: Math.min(3, pagination?.pages || 1) }, (_, i) => i + 1).map(n => (
                    <Button 
                      key={n}
                      variant={ordersPage === n ? "default" : "outline"}
                      className={`h-9 w-9 rounded-xl text-xs font-bold border-none transition-all ${
                        ordersPage === n ? "bg-primary text-white shadow-lg shadow-primary/30 scale-105" : "bg-white/70 hover:bg-white"
                      }`}
                      onClick={() => setOrdersPage(n)}
                    >
                      {n}
                    </Button>
                  ))}
                </div>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-9 w-9 rounded-xl bg-white/70 border-none shadow-sm disabled:opacity-30 hover:bg-white transition-all"
                  onClick={() => setOrdersPage(p => p + 1)}
                  disabled={ordersPage >= (pagination?.pages || 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>

          {/* Categories & Feedback */}
          <div className="lg:col-span-4 space-y-6">
            {/* Feedback Section */}
            <Card className="border-none shadow-lg bg-[#2C1810] text-[#F9F5F0] overflow-hidden relative">
              {isFetchingActivity && (
                <div className="absolute top-4 right-4 z-10 w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              )}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full -mr-16 -mt-16 blur-2xl" />
              <CardContent className="p-6 relative">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold">{t(DashboardMessages.RECENT_FEEDBACK)}</h3>
                  <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-md">
                    <MessageSquare className="h-5 w-5 text-amber-500" />
                  </div>
                </div>
                <div className="space-y-6">
                  {recentComments.map((comment: any, index: number) => (
                    <div 
                      key={comment.id} 
                      className={`group cursor-pointer relative p-3 -mx-3 rounded-2xl transition-all duration-500 ${
                        index === 0 ? 'bg-white/5 ring-1 ring-amber-500/20 shadow-2xl shadow-amber-500/5 mt-1' : 'hover:bg-white/5'
                      }`}
                    >
                      {index === 0 && (
                        <div className="absolute -top-2 left-6 px-2 py-0.5 bg-amber-500 text-[8px] font-black text-[#211810] uppercase tracking-widest rounded-full shadow-lg z-10 animate-pulse">
                          {t(DashboardMessages.LATEST)}
                        </div>
                      )}
                      <div className="flex gap-4">
                        <div className="relative">
                          <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center font-bold text-xs ring-2 ring-transparent group-hover:ring-amber-500/40 transition-all duration-300">
                            {comment.avatar ? (
                              <img src={comment.avatar} alt="" className="w-full h-full object-cover rounded-xl" />
                            ) : (
                              comment.author?.charAt(0) || 'U'
                            )}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-amber-500 tracking-widest uppercase truncate pr-4">{comment.author}</span>
                            <span className="text-[9px] font-bold opacity-30 whitespace-nowrap">{format(new Date(comment.date), 'MMM d')}</span>
                          </div>
                          <p className="text-sm mt-1 leading-relaxed opacity-70 line-clamp-2 italic font-serif">"{comment.comment}"</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
