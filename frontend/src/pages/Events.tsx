import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Calendar, Clock, CheckCircle2, MapPin, Loader2, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { hi, enUS } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { EventCard } from "@/components/EventCard";
import { Event } from "@/types";
import { useAuthStore } from "@/store/authStore";

import { useInfiniteQuery } from "@tanstack/react-query";
import { eventService } from "@/services/event.service";
import { PhoneInput } from "@/components/ui/phone-input";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { EventMessages } from "@/constants/messages/EventMessages";

export default function Events() {
  const { t, i18n } = useTranslation();
  const currentLocale = i18n.language === "hi" ? hi : enUS;
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "all";

  const setActiveTab = (tab: string) => {
    setSearchParams({ tab });
  };
  const [registrationData, setRegistrationData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const handleRegister = (event: Event) => {
    setSelectedEvent(event);
    setRegistrationOpen(true);
  };

  const handleSubmitRegistration = (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.email || user.email.trim() === "") {
      toast({
        title: t(EventMessages.EMAIL_REQUIRED_TITLE),
        description: t(EventMessages.EMAIL_REQUIRED_DESC),
        variant: "destructive",
      });
      return;
    }

    const newErrors: Record<string, string> = {};
    if (!registrationData.name) newErrors.name = t(EventMessages.FILL_REQUIRED);
    if (!registrationData.email) newErrors.email = t(EventMessages.FILL_REQUIRED);
    if (!registrationData.phone) newErrors.phone = t(EventMessages.FILL_REQUIRED);

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast({
        title: t(EventMessages.ERROR),
        description: t(EventMessages.FILL_REQUIRED),
        variant: "destructive",
      });
      return;
    }

    setErrors({});
    // TODO: Submit registration to backend
    toast({
      title: t(EventMessages.REGISTRATION_SUCCESS),
      description: t(EventMessages.CONFIRMATION_SENT),
    });

    setRegistrationOpen(false);
    setRegistrationData({ name: "", email: "", phone: "", message: "" });
    setErrors({});
  };

  const renderEventList = (emptyIcon: React.ReactNode, emptyMessage: string) => {
    if (isLoading) {
      return (
        <div className="min-h-[400px] relative">
          <LoadingOverlay message={t(EventMessages.LOADING_EVENTS)} isLoading={true} />
        </div>
      );
    }

    if (events.length === 0) {
      return (
        <div className="text-center py-12">
          {emptyIcon}
          <p className="text-muted-foreground text-lg mt-4">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <div key={event.id} className="w-full max-w-[420px] mx-auto">
              <EventCard event={event} onRegister={handleRegister} />
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
    <div className="min-h-screen bg-background pb-20">
      <LoadingOverlay message={t(EventMessages.LOADING_EVENTS)} isLoading={isLoading && !isFetchingNextPage} />

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

      {/* Registration Dialog */}
      <Dialog open={registrationOpen} onOpenChange={setRegistrationOpen}>
        <DialogContent className="sm:max-w-md rounded-[2rem] border-none shadow-elevated p-8">
          <DialogHeader className="space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-[#B85C3C]/10 flex items-center justify-center mb-2">
              <Calendar className="h-6 w-6 text-[#B85C3C]" />
            </div>
            <DialogTitle className="text-2xl font-bold font-playfair text-center">{t(EventMessages.REGISTER_FOR)}</DialogTitle>
            <DialogDescription className="text-center text-muted-foreground/80 leading-relaxed italic">
              "{selectedEvent?.title || t(EventMessages.PLACEHOLDER_COMPLETE_DETAILS)}"
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitRegistration} className="space-y-6 mt-6">
            <div className="space-y-2">
              <Label htmlFor="reg-name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">
                {t(EventMessages.FULL_NAME)} <span className="text-[#B85C3C]">*</span>
              </Label>
              <Input
                id="reg-name"
                type="text"
                value={registrationData.name}
                onChange={(e) => {
                  setRegistrationData({
                    ...registrationData,
                    name: e.target.value,
                  });
                  if (errors.name) setErrors(prev => ({ ...prev, name: "" }));
                }}
                placeholder={t(EventMessages.PLACEHOLDER_NAME)}
                className={`h-12 rounded-xl bg-muted/30 border-none focus-visible:ring-1 focus-visible:ring-[#B85C3C] ${errors.name ? "ring-1 ring-destructive" : ""}`}
                required
              />
              {errors.name && <p className="text-xs text-destructive ml-1">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reg-email" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">
                {t(EventMessages.EMAIL)} <span className="text-[#B85C3C]">*</span>
              </Label>
              <Input
                id="reg-email"
                type="email"
                value={registrationData.email}
                onChange={(e) => {
                  setRegistrationData({
                    ...registrationData,
                    email: e.target.value,
                  });
                  if (errors.email) setErrors(prev => ({ ...prev, email: "" }));
                }}
                placeholder={t(EventMessages.PLACEHOLDER_EMAIL)}
                className={`h-12 rounded-xl bg-muted/30 border-none focus-visible:ring-1 focus-visible:ring-[#B85C3C] ${errors.email ? "ring-1 ring-destructive" : ""}`}
                required
              />
              {errors.email && <p className="text-xs text-destructive ml-1">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <PhoneInput
                id="reg-phone"
                value={registrationData.phone}
                onChange={(val) => {
                  setRegistrationData({
                    ...registrationData,
                    phone: val,
                  });
                  if (errors.phone) setErrors(prev => ({ ...prev, phone: "" }));
                }}
                label={t(EventMessages.PHONE)}
                required
                error={errors.phone}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reg-message" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">{t(EventMessages.MESSAGE)}</Label>
              <Textarea
                id="reg-message"
                value={registrationData.message}
                onChange={(e) =>
                  setRegistrationData({
                    ...registrationData,
                    message: e.target.value,
                  })
                }
                placeholder={t(EventMessages.MESSAGE_PLACEHOLDER)}
                rows={3}
                className="rounded-xl bg-muted/30 border-none focus-visible:ring-1 focus-visible:ring-[#B85C3C] resize-none"
              />
            </div>

            {selectedEvent && (
              <div className="bg-[#2C1810]/5 p-4 rounded-2xl border border-[#2C1810]/10 text-sm space-y-2">
                <div className="flex items-center gap-3 text-[#2C1810]">
                  <Calendar className="h-4 w-4 text-[#B85C3C]" />
                  <span className="font-semibold">{format(new Date(selectedEvent.startDate), "PPP", { locale: currentLocale })}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <MapPin className="h-4 w-4 text-[#B85C3C]" />
                  <span>{selectedEvent.location.address}</span>
                </div>
              </div>
            )}

            <Button type="submit" className="w-full h-14 rounded-full bg-[#B85C3C] hover:bg-[#2C1810] text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all">
              {t(EventMessages.CONFIRM_REGISTRATION)}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
