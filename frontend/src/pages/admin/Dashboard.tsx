import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, Calendar, FileText, ShoppingCart, Users, Heart, Shield, Activity, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { analyticsService, DashboardStats } from '@/services/analytics.service';
import { format } from 'date-fns';
import { getDateLocale } from '@/utils/dateLocale';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { DashboardAlerts } from '@/components/admin/DashboardAlerts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingOverlay, LoadingOverlayRelative } from "@/components/ui/loading-overlay";
import { Order } from '@/types';


export default function AdminDashboard() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation(); // Add hook usage if not present, checking imports
  const [ordersPage, setOrdersPage] = useState(1);
  const ordersLimit = 10;
  const isDashboardRoute = location.pathname.startsWith('/admin') || location.pathname.startsWith('/manager');

  const { data: dashboardData, isLoading: isStatsLoading, isFetching: isStatsFetching, error: statsError } = useQuery<DashboardStats>({
    queryKey: ['admin-dashboard', ordersPage],
    queryFn: () => analyticsService.getDashboardStats({ ordersPage, ordersLimit }),
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    placeholderData: keepPreviousData,
    enabled: !!user && (user.role === 'admin' || user.role === 'manager') && isDashboardRoute,
  });

  // Real-time notifications
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        toast.info(t('admin.dashboard.notifications.newOrder', { number: payload.new.order_number }), {
          duration: 60000,
          icon: <ShoppingCart className="h-4 w-4" />
        });
        queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'donations' }, (payload) => {
        toast.info(t('admin.dashboard.notifications.newDonation', { amount: payload.new.amount }), {
          duration: 60000,
          icon: <Heart className="h-4 w-4 text-red-500" />
        });
        queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_registrations' }, () => {
        toast.info(t('admin.dashboard.notifications.newEventReg'), {
          duration: 60000,
          icon: <Calendar className="h-4 w-4" />
        });
        queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'returns' }, (payload) => {
        // Only notify on initial request
        if (payload.new.status === 'requested') {
          toast.info(t('admin.dashboard.notifications.newReturn'), {
            duration: 60000,
            icon: <RotateCcw className="h-4 w-4 text-orange-500" />,
            action: {
              label: t('admin.dashboard.notifications.viewOrders'),
              onClick: () => navigate("/admin/orders?status=return_requested")
            }
          });
          queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, navigate]);

  if (statsError) {
    return (
      <div className="p-8 text-center text-red-500">
        <h3 className="text-lg font-bold">{t('admin.dashboard.error.failedLoad')}</h3>
        <p className="text-sm opacity-80 mb-4">{statsError.message}</p>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })}>
          {t('admin.dashboard.error.retry')}
        </Button>
      </div>
    );
  }

  const stats = dashboardData?.stats;
  const productCategories = dashboardData?.productCategories;
  // Use orders from the separate query
  const recentOrders = dashboardData?.recentOrders?.data || [];
  const ordersPagination = dashboardData?.recentOrders?.pagination;

  const upcomingEvents = dashboardData?.upcomingEvents;
  const ongoingEvents = dashboardData?.ongoingEvents;

  const dashboardStats = [
    {
      title: t('admin.dashboard.stats.activeEvents'),
      value: stats?.activeEvents?.toString() || '0',
      icon: Calendar,
      trend: (stats?.newEventsCount || 0) > 0
        ? t('admin.dashboard.stats.thisWeek', { count: Number(stats?.newEventsCount || 0) })
        : t('admin.dashboard.stats.noNew', { item: t('admin.dashboard.stats.activeEvents') }),
      trendUp: (stats?.newEventsCount || 0) > 0,
    },
    {
      title: t('admin.dashboard.stats.ongoingEvents'),
      value: ongoingEvents?.length.toString() || '0',
      icon: Activity,
      trend: t('admin.dashboard.stats.now'),
      trendUp: true,
    },
    {
      title: t('admin.dashboard.stats.blogPosts'),
      value: stats?.blogPosts?.toString() || '0',
      icon: FileText,
      trend: t('admin.dashboard.stats.all'),
      trendUp: true,
    },
  ];

  // Add Admin-only cards
  if (user?.role === 'admin' && stats) {
    dashboardStats.push(
      {
        title: t('admin.dashboard.stats.totalManagers'),
        value: stats?.totalManagers?.toString() || '0',
        icon: Shield,
        trend: t('admin.dashboard.stats.adminsOnly'),
        trendUp: true
      },
      {
        title: t('admin.dashboard.stats.totalCustomers'),
        value: stats?.totalCustomers?.toString() || '0',
        icon: Users,
        trend: (stats?.newCustomersCount || 0) > 0
          ? t('admin.dashboard.stats.thisWeek', { count: Number(stats?.newCustomersCount || 0) })
          : t('admin.dashboard.stats.noNew', { item: t('admin.dashboard.stats.totalCustomers') }),
        trendUp: (stats?.newCustomersCount || 0) > 0,
      },
      {
        title: t('admin.dashboard.stats.totalDonations'),
        value: t('common.currency') + (stats?.totalDonations?.toLocaleString() || '0'),
        icon: Heart,
        trend: (stats?.newDonationsAmount || 0) > 0
          ? `+${t('common.currency')}${stats.newDonationsAmount.toLocaleString()} ${t('admin.dashboard.stats.thisWeekNoCount')}`
          : t('admin.dashboard.stats.noNew', { item: t('admin.dashboard.stats.totalDonations') }),
        trendUp: (stats?.newDonationsAmount || 0) > 0,
      }
    );
  }

  if (isStatsLoading) {
    return <LoadingOverlay isLoading={true} message={t('admin.dashboard.loading')} />;
  }

  return (
    <div className="space-y-8 relative">
      {/* Background Sync Indicator */}
      {isStatsFetching && !isStatsLoading && (
        <div className="absolute top-0 right-0 z-50 p-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/80 backdrop-blur-sm border border-[#B85C3C]/20 rounded-full shadow-sm">
            <div className="w-2 h-2 bg-[#B85C3C] rounded-full animate-pulse" />
            <span className="text-[10px] font-medium text-[#B85C3C] uppercase tracking-wider">{t('admin.dashboard.syncing')}</span>
          </div>
        </div>
      )}

      {/* Header with gradient accent */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-[#B85C3C]/5 via-transparent to-[#2C1810]/5 rounded-2xl -z-10" />
        <div className="py-2">
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-[#2C1810] to-[#B85C3C] bg-clip-text text-transparent">
            {t('admin.dashboard.title')}
          </h2>
          <p className="text-muted-foreground mt-1">{t('admin.dashboard.subtitle')}</p>
        </div>
      </div>

      {/* Persistent Alerts */}
      <DashboardAlerts />

      {/* Stats Grid with enhanced cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {dashboardStats.map((stat, index) => (
          <Card
            key={index}
            className="group relative overflow-hidden border-none shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
          >
            {/* Decorative gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-[#FDFBF7] opacity-100" />
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#B85C3C]/5 to-transparent rounded-bl-full" />

            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[#2C1810]/80">{stat.title}</CardTitle>
              <div className={`p-2 rounded-xl transition-all duration-300 group-hover:scale-110 ${stat.title === 'Total Donations' ? 'bg-red-50 text-red-500' :
                stat.title === 'Ongoing Events' ? 'bg-green-50 text-green-500' :
                  'bg-[#FDFBF7] text-[#B85C3C]'
                }`}>
                <stat.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-bold text-[#2C1810]">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${stat.trendUp ? 'bg-green-500' : 'bg-muted-foreground'
                  }`} />
                {stat.trend}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Events & Categories Row - Above Recent Orders */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Ongoing Events */}
        <Card className="group relative overflow-hidden border-none shadow-md hover:shadow-lg transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-green-50/50 via-white to-white" />
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-green-400" />
          <CardHeader className="relative">
            <CardTitle className="flex items-center gap-3 text-[#2C1810]">
              <div className="relative">
                <div className="absolute inset-0 bg-green-400 rounded-xl animate-ping opacity-20" />
                <div className="relative p-2 rounded-xl bg-green-100">
                  <Activity className="h-5 w-5 text-green-600" />
                </div>
              </div>
              <span>{t('admin.dashboard.ongoingEvents.title')}</span>
              {ongoingEvents && ongoingEvents.length > 0 && (
                <span className="ml-auto text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">
                  {t('admin.dashboard.ongoingEvents.live', { count: ongoingEvents.length })}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="space-y-3 max-h-[200px] overflow-y-auto">
              {ongoingEvents && ongoingEvents.length > 0 ? (
                ongoingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-white border border-green-100 hover:border-green-200 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#2C1810] truncate">{event.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('admin.dashboard.ongoingEvents.ends', { date: format(new Date(event.endDate), 'PPP', { locale: getDateLocale() }) })}
                      </p>
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <p className="text-sm font-semibold text-green-600">{event.registeredCount}</p>
                      <p className="text-xs text-muted-foreground">{t('admin.dashboard.ongoingEvents.registered')}</p>
                      {event.cancelledCount > 0 && (
                        <p className="text-xs text-red-500 mt-1">-{event.cancelledCount}</p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <Activity className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{t('admin.dashboard.ongoingEvents.noEvents')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card className="group relative overflow-hidden border-none shadow-md hover:shadow-lg transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-[#B85C3C]/5 via-white to-white" />
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#B85C3C] to-[#D4846A]" />
          <CardHeader className="relative">
            <CardTitle className="flex items-center gap-3 text-[#2C1810]">
              <div className="p-2 rounded-xl bg-[#FDFBF7]">
                <Calendar className="h-5 w-5 text-[#B85C3C]" />
              </div>
              <span>{t('admin.dashboard.upcomingEvents.title')}</span>
              {upcomingEvents && upcomingEvents.length > 0 && (
                <span className="ml-auto text-xs font-medium px-2 py-1 rounded-full bg-[#FDFBF7] text-[#B85C3C]">
                  {t('admin.dashboard.upcomingEvents.scheduled', { count: upcomingEvents.length })}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="space-y-3 max-h-[200px] overflow-y-auto">
              {upcomingEvents && upcomingEvents.length > 0 ? (
                upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#B85C3C]/10 hover:border-[#B85C3C]/20 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#2C1810] truncate">{event.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(event.date), 'PPP', { locale: getDateLocale() })}
                      </p>
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <p className="text-sm font-semibold text-[#B85C3C]">{event.registeredCount}</p>
                      <p className="text-xs text-muted-foreground">{t('admin.dashboard.ongoingEvents.registered')}</p>
                      {event.cancelledCount > 0 && (
                        <p className="text-xs text-red-500 mt-1">-{event.cancelledCount}</p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{t('admin.dashboard.upcomingEvents.noEvents')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Categories */}
        <Card className="group relative overflow-hidden border-none shadow-md hover:shadow-lg transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-50/50 via-white to-white" />
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-amber-400" />
          <CardHeader className="relative">
            <CardTitle className="flex items-center gap-3 text-[#2C1810]">
              <div className="p-2 rounded-xl bg-amber-50">
                <Package className="h-5 w-5 text-amber-600" />
              </div>
              <span>{t('admin.dashboard.topCategories.title')}</span>
              {productCategories && productCategories.length > 0 && (
                <span className="ml-auto text-xs font-medium px-2 py-1 rounded-full bg-amber-50 text-amber-700">
                  {t('admin.dashboard.topCategories.total', { count: productCategories.length })}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            {productCategories && productCategories.length > 0 ? (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {productCategories.slice(0, 5).map((cat, index) => (
                  <div
                    key={cat.category}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white border border-amber-100 hover:border-amber-200 transition-colors"
                  >
                    <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-amber-100 text-amber-700 text-xs font-bold">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#2C1810] text-sm truncate">{cat.category}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-sm font-semibold text-amber-600">{cat.count}</span>
                      <span className="text-xs text-muted-foreground ml-1">{t('admin.dashboard.topCategories.items')}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t('admin.dashboard.topCategories.noProducts')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders - Full Width Below */}
      <Card className="relative overflow-hidden border-none shadow-md">
        <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-[#FDFBF7]" />
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#2C1810] via-[#B85C3C] to-[#D4846A]" />
        <CardHeader className="relative">
          <CardTitle className="flex items-center gap-3 text-[#2C1810]">
            <div className="p-2 rounded-xl bg-[#FDFBF7]">
              <ShoppingCart className="h-5 w-5 text-[#B85C3C]" />
            </div>
            <span>{t('admin.dashboard.recentOrders.title')}</span>
            {ordersPagination && ordersPagination.total > 0 && (
              <span className="ml-auto text-xs font-medium px-2 py-1 rounded-full bg-[#FDFBF7] text-[#B85C3C]">
                {t('admin.dashboard.recentOrders.total', { count: ordersPagination.total })}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="relative">
          {/* Table Loading Overlay - Only on pagination/search (placeholder data) */}
          {(isStatsFetching && !isStatsLoading) && (
            <LoadingOverlayRelative isLoading={true} message={t('admin.dashboard.recentOrders.syncing')} className="z-10 bg-white/40 backdrop-blur-[1px]" />
          )}

          {isStatsLoading ? (
            <div className="h-48 flex items-center justify-center">
              <LoadingOverlayRelative isLoading={true} message={t('admin.dashboard.recentOrders.loading')} />
            </div>
          ) : (
            <div className="rounded-xl border border-border/50 bg-white overflow-hidden">
              <Table>
                <TableHeader className="bg-[#FDFBF7]">
                  <TableRow className="hover:bg-transparent border-b-border/50">
                    <TableHead className="w-[120px] font-bold text-[#2C1810]">{t('admin.dashboard.recentOrders.orderNumber')}</TableHead>
                    <TableHead className="font-bold text-[#2C1810]">{t('admin.dashboard.recentOrders.customer')}</TableHead>
                    <TableHead className="hidden sm:table-cell font-bold text-[#2C1810]">{t('admin.dashboard.recentOrders.date')}</TableHead>
                    <TableHead className="font-bold text-[#2C1810]">{t('admin.dashboard.recentOrders.status')}</TableHead>
                    <TableHead className="text-right font-bold text-[#2C1810]">{t('admin.dashboard.recentOrders.amount')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders && recentOrders.length > 0 ? (
                    recentOrders.map((order: Order) => (
                      <TableRow key={order.id} className="hover:bg-[#FDFBF7]/50 transition-colors border-b-border/50">
                        <TableCell className="font-medium text-[#2C1810]">
                          #{order.order_number || 'N/A'}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold text-[#2C1810]">{order.customer_name || t('admin.dashboard.recentOrders.guest')}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex flex-col text-xs text-muted-foreground">
                            <span>{order.created_at ? format(new Date(order.created_at as string), 'MMM d, yyyy', { locale: getDateLocale() }) : 'N/A'}</span>
                            <span>{order.created_at ? format(new Date(order.created_at as string), 'h:mm a', { locale: getDateLocale() }) : ''}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`capitalize text-[10px] font-bold px-2 py-0 h-5 border-none ${order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                              order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                order.status === 'cancelled' ? 'bg-red-100 text-red-700' : ''
                              }`}
                          >
                            {order.status ? t(`status.${order.status}`) : t('common.na')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold text-[#2C1810]">
                          {t('common.currency')}{(order.total_amount ?? order.total ?? 0).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-48 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <ShoppingCart className="h-10 w-10 text-muted-foreground/30" />
                          <p className="text-muted-foreground">{t('admin.dashboard.recentOrders.noOrders')}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination Controls */}
          {ordersPagination && ordersPagination.page > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                {t('admin.dashboard.recentOrders.showing', {
                  start: ((ordersPage - 1) * ordersLimit) + 1,
                  end: Math.min(ordersPage * ordersLimit, ordersPagination.total),
                  total: ordersPagination.total
                })}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setOrdersPage(p => Math.max(1, p - 1));
                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                  }}
                  disabled={ordersPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, ordersPagination.page) }, (_, i) => {
                    let pageNum;
                    if (ordersPagination.page <= 5) pageNum = i + 1;
                    else if (ordersPage <= 3) pageNum = i + 1;
                    else if (ordersPage >= ordersPagination.page - 2) pageNum = ordersPagination.page - 4 + i;
                    else pageNum = ordersPage - 2 + i;

                    return (
                      <Button
                        key={pageNum}
                        variant={ordersPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setOrdersPage(pageNum);
                          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                        }}
                        className={`h-8 w-8 p-0 ${ordersPage === pageNum ? "bg-[#B85C3C] hover:bg-[#B85C3C]/90" : ""}`}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setOrdersPage(p => Math.min(ordersPagination.page, p + 1));
                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                  }}
                  disabled={ordersPage === ordersPagination.page}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
