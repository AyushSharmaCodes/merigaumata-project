import { useState, useRef, useEffect } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useToast } from "@/shared/hooks/use-toast";
import { analyticsService } from '@/domains/admin';

export const useDashboardPage = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const chartsSectionRef = useRef<HTMLDivElement | null>(null);
  const [shouldRenderChartsSection, setShouldRenderChartsSection] = useState(false);
  const [ordersPage, setOrdersPage] = useState(1);
  const [summaryTimeframe, setSummaryTimeframe] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');
  const [revenueTimeframe, setRevenueTimeframe] = useState<'weekly' | 'monthly' | 'yearly'>('yearly');
  const [orderSummaryTimeframe, setOrderSummaryTimeframe] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [categoryTimeframe, setCategoryTimeframe] = useState<'weekly' | 'monthly' | 'yearly'>('yearly');
  const [isExporting, setIsExporting] = useState(false);
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
    staleTime: 300000 // 5 minutes
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

  return {
    t,
    summaryData,
    chartsData,
    activityData,
    isFetchingSummary,
    isLoadingSummary,
    isFetchingCharts,
    isLoadingCharts,
    isFetchingActivity,
    isLoadingActivity,
    ordersPage,
    setOrdersPage,
    summaryTimeframe,
    setSummaryTimeframe,
    revenueTimeframe,
    setRevenueTimeframe,
    orderSummaryTimeframe,
    setOrderSummaryTimeframe,
    categoryTimeframe,
    setCategoryTimeframe,
    isExporting,
    handleExport,
    chartsSectionRef,
    shouldRenderChartsSection,
    ordersLimit
  };
};
