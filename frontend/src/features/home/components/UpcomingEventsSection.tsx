import { Link } from "react-router-dom";
import { Heart, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { EventCard } from "@/features/events";
import { Event } from "@/shared/types";
import { useTranslation } from "react-i18next";
import { HomeMessages } from "@/shared/constants/messages/HomeMessages";
import { EventMessages } from "@/shared/constants/messages/EventMessages";

interface UpcomingEventsSectionProps {
    events: Event[];
    scrollRef: React.RefObject<HTMLDivElement>;
    onScroll: (direction: "left" | "right") => void;
}

export const UpcomingEventsSection = ({ events, scrollRef, onScroll }: UpcomingEventsSectionProps) => {
    const { t } = useTranslation();

    return (
        <section className="py-12 bg-[#FAF7F2] relative overflow-hidden">
            <div className="absolute top-0 right-0 p-24 opacity-5 pointer-events-none">
                <Heart className="h-96 w-96 text-[#B85C3C]" />
            </div>

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 mb-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-foreground/5 text-foreground text-[10px] font-bold uppercase tracking-widest">
                            <Sparkles className="h-3 w-3" /> {t(HomeMessages.EVENTS_BADGE)}
                        </div>
                        <h2 className="text-4xl md:text-6xl font-bold font-playfair text-foreground">{t(HomeMessages.EVENTS_TITLE)}</h2>
                        <p className="text-muted-foreground text-base md:text-lg font-light max-w-xl">{t(HomeMessages.EVENTS_DESC)}</p>
                    </div>
                    <Link to="/events">
                        <Button variant="outline" className="rounded-full px-8 py-6 border-[#2C1810]/20 hover:bg-[#2C1810] hover:text-white transition-all duration-500 font-bold uppercase tracking-widest text-xs h-auto bg-transparent">
                            {t(EventMessages.VIEW_ALL)}
                        </Button>
                    </Link>
                </div>
            </div>

            {events.length > 0 ? (
                <div className="group/events-scroll relative z-10 mx-4 sm:mx-6">
                    <div
                        ref={scrollRef}
                        className="flex gap-8 overflow-x-auto scrollbar-hide pb-8 pt-4 snap-x snap-mandatory"
                        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                    >
                        {events.map((event) => (
                            <div key={event.id} className="flex-shrink-0 w-[300px] sm:w-[420px] snap-start">
                                <EventCard event={event} />
                            </div>
                        ))}
                    </div>

                    <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 flex justify-between pointer-events-none px-4">
                        <Button
                            variant="outline" size="icon"
                            className="h-12 w-12 rounded-full shadow-xl bg-white/90 backdrop-blur-sm border-none pointer-events-auto opacity-0 group-hover/events-scroll:opacity-100 transition-all duration-500 hover:bg-[#B85C3C] hover:text-white"
                            onClick={() => onScroll("left")}
                        >
                            <ChevronLeft className="h-6 w-6" />
                        </Button>
                        <Button
                            variant="outline" size="icon"
                            className="h-12 w-12 rounded-full shadow-xl bg-white/90 backdrop-blur-sm border-none pointer-events-auto opacity-0 group-hover/events-scroll:opacity-100 transition-all duration-500 hover:bg-[#B85C3C] hover:text-white"
                            onClick={() => onScroll("right")}
                        >
                            <ChevronRight className="h-6 w-6" />
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="text-center py-20 bg-white/50 rounded-[3rem] border-2 border-dashed border-[#2C1810]/10">
                        <p className="text-muted-foreground text-lg italic font-light">{t(HomeMessages.EVENTS_NO_EVENTS)}</p>
                    </div>
                </div>
            )}
        </section>
    );
};
