import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Calendar, Clock, CheckCircle2, MapPin, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventCard } from "@/components/EventCard";

import { useInfiniteQuery } from "@tanstack/react-query";
import { eventService } from "@/services/event.service";
import { GridSkeleton } from "@/components/ui/page-skeletons";
import { EventMessages } from "@/constants/messages/EventMessages";

/**
 * Events Page - Refactored for High Performance
 * Uses Skeleton-First architecture to eliminate blocking loading overlays.
 */
export default function Events() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "all";

  const setActiveTab = (tab: string) => {
    setSearchParams({ tab });
  };

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["events", activeTab, i18n.language],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await eventService.getAll({
        page: pageParam,
        limit: 10,
        status: activeTab,
      });
      return response;
    },
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.flatMap((p) => p.events).length;
      if (loadedCount < lastPage.total) {
        return allPages.length + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });

  const allEvents = data?.pages.flatMap((page) => page.events) || [];
  const events = Array.from(new Map(allEvents.map(e => [e.id, e])).values());
  const totalEvents = data?.pages[0]?.total || 0;

  const renderEventList = (emptyIcon: React.ReactNode, emptyMessage: string) => {
    // PERFORMANCE: Use GridSkeleton for initial fetch within tabs
    if (isLoading && events.length === 0) {
      return <GridSkeleton columns={3} count={6} />;
    }

    if (events.length === 0) {
      return (
        <div className="text-center py-12 animate-in fade-in duration-500">
          {emptyIcon}
          <p className="text-muted-foreground text-lg mt-4">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="space-y-8 animate-in fade-in duration-700">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <div key={event.id} className="w-full max-w-[420px] mx-auto">
              <EventCard event={event} />
            </div>
          ))}
        </div>

        {hasNextPage && (
          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              size="lg"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="min-w-[200px]"
            >
              {isFetchingNextPage ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t(EventMessages.LOADING_MORE)}
                </>
              ) : (
                t(EventMessages.LOAD_MORE)
              )}
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-20 animate-in fade-in duration-700">
      {/* Compact Premium Hero Section (Unified Height) */}
      <section className="bg-[#2C1810] text-white py-12 md:py-16 relative overflow-hidden shadow-2xl">
        {/* Abstract Background Decoration */}
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Calendar className="h-64 w-64 text-[#D4AF37] blur-sm" />
        </div>
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-[#B85C3C]/10 rounded-full blur-[100px]" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-[#D4AF37]/10 text-[#D4AF37] text-[10px] font-bold uppercase tracking-[0.2em] mb-2">
                <Sparkles className="h-3 w-3" /> {t(EventMessages.SPIRIT_BADGE)}
              </div>
              <h1 className="text-3xl md:text-5xl font-bold font-playfair">
                {t(EventMessages.SACRED)} <span className="text-[#D4AF37] italic">{t(EventMessages.GATHERINGS)}</span>
              </h1>
            </div>

            <div className="flex flex-col md:flex-row gap-6 md:items-center max-w-xl">
              <p className="text-white/50 text-sm md:text-base font-light border-l border-[#D4AF37]/30 pl-6 hidden md:block">
                {t(EventMessages.SUBTITLE)}
              </p>
              <div className="flex items-center gap-4 text-sm font-medium">
                <div className="px-4 py-2 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#D4AF37] min-w-[120px]">
                  <span className="block text-[9px] uppercase tracking-wider opacity-60 mb-0.5">{t(EventMessages.UPCOMING)}</span>
                  <span className="text-base font-bold">{totalEvents} {t(EventMessages.ACTIVE_COUNT)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-20">
        {/* Events Tabs Navigation - Modernized */}
        <Tabs value={activeTab} className="w-full" onValueChange={setActiveTab}>
          <div className="flex justify-center mb-12">
            <TabsList className="h-16 rounded-full bg-white shadow-elevated p-1.5 border border-border/50">
              <TabsTrigger value="all" className="rounded-full px-8 data-[state=active]:bg-[#2C1810] data-[state=active]:text-white transition-all font-bold text-xs uppercase tracking-widest">
                {t(EventMessages.ALL_TAB)} {activeTab === "all" && events.length > 0 && <span className="ml-2 opacity-50">{totalEvents}</span>}
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="rounded-full px-8 data-[state=active]:bg-[#2C1810] data-[state=active]:text-white transition-all font-bold text-xs uppercase tracking-widest">
                {t(EventMessages.UPCOMING)} {activeTab === "upcoming" && events.length > 0 && <span className="ml-2 opacity-50">{totalEvents}</span>}
              </TabsTrigger>
              <TabsTrigger value="ongoing" className="rounded-full px-8 data-[state=active]:bg-[#2C1810] data-[state=active]:text-white transition-all font-bold text-xs uppercase tracking-widest">
                {t(EventMessages.ONGOING)} {activeTab === "ongoing" && events.length > 0 && <span className="ml-2 opacity-50">{totalEvents}</span>}
              </TabsTrigger>
              <TabsTrigger value="completed" className="rounded-full px-8 data-[state=active]:bg-[#2C1810] data-[state=active]:text-white transition-all font-bold text-xs uppercase tracking-widest">
                {t(EventMessages.COMPLETED)} {activeTab === "completed" && events.length > 0 && <span className="ml-2 opacity-50">{totalEvents}</span>}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-[400px]">
            <TabsContent value="all" className="mt-0 focus-visible:outline-none">
              {renderEventList(
                <div className="mb-6 inline-flex p-6 rounded-full bg-muted/50"><Calendar className="h-12 w-12 text-muted-foreground/50" /></div>,
                t(EventMessages.NO_EVENTS_FOUND)
              )}
            </TabsContent>

            <TabsContent value="upcoming" className="mt-0 focus-visible:outline-none">
              {renderEventList(
                <div className="mb-6 inline-flex p-6 rounded-full bg-muted/50"><Clock className="h-12 w-12 text-muted-foreground/50" /></div>,
                t(EventMessages.NO_UPCOMING)
              )}
            </TabsContent>

            <TabsContent value="ongoing" className="mt-0 focus-visible:outline-none">
              {renderEventList(
                <div className="mb-6 inline-flex p-6 rounded-full bg-muted/50"><Clock className="h-12 w-12 text-muted-foreground/50" /></div>,
                t(EventMessages.NO_ONGOING)
              )}
            </TabsContent>

            <TabsContent value="completed" className="mt-0 focus-visible:outline-none">
              {renderEventList(
                <div className="mb-6 inline-flex p-6 rounded-full bg-muted/50"><CheckCircle2 className="h-12 w-12 text-muted-foreground/50" /></div>,
                t(EventMessages.NO_COMPLETED)
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
