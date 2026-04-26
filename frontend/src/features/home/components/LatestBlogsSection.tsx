import { Link } from "react-router-dom";
import { Leaf, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { BlogCard } from "@/features/blog";
import { Blog } from "@/shared/types";
import { useTranslation } from "react-i18next";
import { HomeMessages } from "@/shared/constants/messages/HomeMessages";

interface LatestBlogsSectionProps {
    blogs: Blog[];
    scrollRef: React.RefObject<HTMLDivElement>;
    onScroll: (direction: "left" | "right") => void;
}

export const LatestBlogsSection = ({ blogs, scrollRef, onScroll }: LatestBlogsSectionProps) => {
    const { t } = useTranslation();

    return (
        <section className="py-12 bg-[#FAF7F2] relative overflow-hidden">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 mb-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest border border-primary/20">
                            <Leaf className="h-3 w-3" /> {t(HomeMessages.WHATS_NEW_BADGE)}
                        </div>
                        <h2 className="text-4xl md:text-5xl font-bold font-playfair text-foreground">{t(HomeMessages.WHATS_NEW_TITLE)}</h2>
                        <p className="text-muted-foreground text-base md:text-lg font-light max-w-xl">{t(HomeMessages.WHATS_NEW_DESC)}</p>
                    </div>
                    <Link to="/blog">
                        <Button variant="outline" className="rounded-full px-8 py-6 border-[#2C1810]/20 hover:bg-[#2C1810] hover:text-white transition-all duration-500 font-bold uppercase tracking-widest text-xs h-auto bg-transparent">
                            {t(HomeMessages.WHATS_NEW_VIEW_ALL)}
                        </Button>
                    </Link>
                </div>
            </div>

            {blogs.length > 0 ? (
                <div className="group/blogs-scroll relative mx-4 sm:mx-6">
                    <div
                        ref={scrollRef}
                        className="flex gap-8 overflow-x-auto scrollbar-hide pb-8 pt-4 snap-x snap-mandatory"
                        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                    >
                        {blogs.map((blog) => (
                            <div key={blog.id} className="flex-shrink-0 w-[300px] sm:w-[380px] snap-start">
                                <BlogCard blog={blog} />
                            </div>
                        ))}
                    </div>

                    <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 flex justify-between pointer-events-none px-4">
                        <Button
                            variant="outline" size="icon"
                            className="h-12 w-12 rounded-full shadow-elevated bg-white/95 backdrop-blur-sm border-none pointer-events-auto opacity-0 group-hover/blogs-scroll:opacity-100 transition-all duration-500 hover:bg-primary hover:text-background"
                            onClick={() => onScroll("left")}
                        >
                            <ChevronLeft className="h-6 w-6" />
                        </Button>
                        <Button
                            variant="outline" size="icon"
                            className="h-12 w-12 rounded-full shadow-elevated bg-white/95 backdrop-blur-sm border-none pointer-events-auto opacity-0 group-hover/blogs-scroll:opacity-100 transition-all duration-500 hover:bg-primary hover:text-background"
                            onClick={() => onScroll("right")}
                        >
                            <ChevronRight className="h-6 w-6" />
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center py-20 bg-white/50 rounded-[3rem] border-2 border-dashed border-[#2C1810]/10">
                        <p className="text-muted-foreground text-lg italic font-light">{t(HomeMessages.WHATS_NEW_NO_BLOGS)}</p>
                    </div>
                </div>
            )}
        </section>
    );
};
