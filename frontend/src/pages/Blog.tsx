import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Search,
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { blogService } from "@/services/blog.service";
import type { Blog } from "@/types";

const POSTS_PER_PAGE = 6;

export default function Blog() {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch all blogs from database
  const { data: allBlogs = [], isLoading } = useQuery({
    queryKey: ["blogs", i18n.language],
    queryFn: async () => {
      return blogService.getAll();
    },
  });

  // Filter only published blogs
  const publishedBlogs = allBlogs.filter((blog: Blog) => blog.published);

  // Get 8 latest published blogs for featured section
  const featuredPosts = publishedBlogs
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  // No fixed categories as per user request


  // Filter posts
  // Filter posts based on search query
  const filteredPosts = publishedBlogs
    .filter((post: any) => {
      const matchesSearch =
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (post.tags || []).some((tag: string) =>
          tag.toLowerCase().includes(searchQuery.toLowerCase())
        );
      return matchesSearch;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Pagination
  const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE);
  const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
  const paginatedPosts = filteredPosts.slice(
    startIndex,
    startIndex + POSTS_PER_PAGE
  );

  const handleCategoryChange = (categoryId: string) => {
    // setSearchQuery(categoryId); // Optional: could Map category to search if needed
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background relative">
        <LoadingOverlay message={t("blog.curating")} isLoading={true} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <LoadingOverlay message={t("blog.curating")} isLoading={isLoading} />

      {/* Premium Compact Hero Section */}
      <section className="bg-[#2C1810] text-white py-12 md:py-16 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <BookOpen className="h-48 w-48 text-[#B85C3C]" />
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-[#B85C3C]/10 text-[#B85C3C] text-[10px] font-bold uppercase tracking-[0.2em] mb-2">
                <Sparkles className="h-3 w-3" /> {t("blog.wisdom")}
              </div>
              <h1 className="text-3xl md:text-5xl font-bold font-playfair">
                {t("blog.title")} <span className="text-[#B85C3C]">{t("blog.journal")}</span>
              </h1>
            </div>
            <p className="text-white/50 text-sm md:text-base max-w-md font-light border-l border-[#B85C3C]/30 pl-6 hidden md:block">
              {t("blog.subtitle")}
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-20">
        {/* Search and Filters - Modernized */}
        <div className="bg-white rounded-3xl p-6 shadow-elevated border border-border/50 mb-12">
          <div className="flex flex-col gap-6">
            {/* Search */}
            <div className="w-full space-y-2">
              <label htmlFor="blog-search" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">{t("blog.searchArticles")}</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#B85C3C]" />
                <Input
                  id="blog-search"
                  name="search"
                  type="text"
                  placeholder={t("blog.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-12 h-14 rounded-2xl bg-muted/30 border-none focus-visible:ring-1 focus-visible:ring-[#B85C3C] transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Featured Posts Carousel */}
        {featuredPosts.length > 0 && searchQuery === "" && (
          <section className="mb-20">
            <div className="flex items-center gap-4 mb-8">
              <h2 className="text-2xl font-bold font-playfair text-[#2C1810]">
                {t("blog.featuredHighlightsPart1")} <span className="text-[#B85C3C]">{t("blog.featuredHighlightsPart2")}</span>
              </h2>
              <div className="h-[1px] flex-1 bg-border/50" />
            </div>

            <Carousel className="w-full max-w-6xl mx-auto group">
              <CarouselContent>
                {featuredPosts.map((post) => (
                  <CarouselItem key={post.id} className="md:basis-1/1 lg:basis-1/1">
                    <Link to={`/blog/${post.id}`}>
                      <Card className="overflow-hidden border-none shadow-soft hover:shadow-elevated transition-all duration-500 rounded-[2.5rem] bg-muted/20">
                        <div className="grid md:grid-cols-2 gap-0 overflow-hidden">
                          <div className="h-64 md:h-[400px] overflow-hidden">
                            <img
                              src={post.image}
                              alt={post.title}
                              loading="lazy"
                              className="w-full h-full object-cover transition-transform duration-700 hover:scale-110"
                            />
                          </div>
                          <div className="p-8 md:p-12 flex flex-col justify-center space-y-6">
                            {post.tags && post.tags.length > 0 && (
                              <Badge className="w-fit bg-[#B85C3C] hover:bg-[#2C1810] transition-colors rounded-full px-4 py-1 uppercase text-[10px] tracking-widest">
                                {post.tags[0]}
                              </Badge>
                            )}
                            <h3 className="text-3xl md:text-4xl font-bold font-playfair text-[#2C1810] leading-tight line-clamp-2">
                              {post.title}
                            </h3>
                            <p className="text-muted-foreground text-lg font-light line-clamp-3 leading-relaxed">
                              {post.excerpt}
                            </p>
                            <div className="flex items-center justify-between pt-4 border-t border-border/50">
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-[#B85C3C]/10 flex items-center justify-center text-[#B85C3C]">
                                    <User className="h-4 w-4" />
                                  </div>
                                  <span className="font-medium">{post.author}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-[#B85C3C]" />
                                  <span>{new Date(post.date).toLocaleDateString(i18n.language, { month: 'short', day: '2-digit', year: 'numeric' })}</span>
                                </div>
                              </div>
                              <div className="hidden md:flex items-center gap-2 text-[#B85C3C] font-bold text-sm uppercase tracking-widest group/btn">
                                {t("blog.readArticle")} <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <div className="hidden md:block">
                <CarouselPrevious className="left-4 bg-white/90 hover:bg-white text-[#2C1810] border-none shadow-lg -translate-x-12 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                <CarouselNext className="right-4 bg-white/90 hover:bg-white text-[#2C1810] border-none shadow-lg translate-x-12 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
              </div>
            </Carousel>
          </section>
        )}

        {/* Blog Posts Grid */}
        <section className="animate-fade-in">
          <div className="flex items-center gap-4 mb-12">
            <h2 className="text-2xl font-bold font-playfair text-[#2C1810]">
              {t("blog.latestArticlesPart1")} <span className="text-[#B85C3C]">{t("blog.latestArticlesPart2")}</span>
            </h2>
            <div className="h-[1px] flex-1 bg-border/50" />
          </div>

          {paginatedPosts.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {paginatedPosts.map((post) => (
                  <Link key={post.id} to={`/blog/${post.id}`} className="group">
                    <Card className="h-full overflow-hidden border-none shadow-soft hover:shadow-elevated transition-all duration-500 rounded-[2rem] bg-white">
                      <div className="aspect-[16/10] overflow-hidden relative">
                        <img
                          src={post.image}
                          alt={post.title}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                        <div className="absolute top-4 left-4">
                          {post.tags && post.tags.length > 0 && (
                            <Badge className="bg-white/95 backdrop-blur-sm text-[#2C1810] hover:bg-[#B85C3C] hover:text-white transition-colors border-none rounded-full px-3 py-1 text-[10px] uppercase tracking-widest font-bold">
                              {post.tags[0]}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <CardHeader className="space-y-4">
                        <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[#B85C3C]">
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            {new Date(post.date).toLocaleDateString(i18n.language, { month: 'short', day: '2-digit', year: 'numeric' })}
                          </span>
                        </div>
                        <CardTitle className="text-xl font-bold font-playfair text-[#2C1810] line-clamp-2 leading-tight group-hover:text-[#B85C3C] transition-colors">
                          {post.title}
                        </CardTitle>
                        <CardDescription className="line-clamp-3 text-muted-foreground/80 leading-relaxed font-light">
                          {post.excerpt}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0 pb-6">
                        <div className="flex items-center justify-between pt-4 border-t border-border/30">
                          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            <User className="h-3.5 w-3.5 text-[#B85C3C]" />
                            <span>{post.author}</span>
                          </div>
                          <ArrowRight className="h-4 w-4 text-[#B85C3C] translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-20">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={currentPage === 1}
                    className="rounded-full w-12 h-12 border-border/50 hover:border-[#B85C3C] hover:text-[#B85C3C]"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>

                  <div className="flex gap-2">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (page) => (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="icon"
                          onClick={() => setCurrentPage(page)}
                          className={`rounded-full w-12 h-12 font-bold transition-all ${currentPage === page
                            ? "bg-[#2C1810] text-white border-[#2C1810]"
                            : "border-border/50 hover:border-[#B85C3C] hover:text-[#B85C3C]"
                            }`}
                        >
                          {page}
                        </Button>
                      )
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="rounded-full w-12 h-12 border-border/50 hover:border-[#B85C3C] hover:text-[#B85C3C]"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-32 bg-muted/20 rounded-[3rem] border-2 border-dashed border-border/50 max-w-4xl mx-auto">
              <div className="mb-6 inline-flex p-6 rounded-full bg-muted/50">
                <BookOpen className="h-12 w-12 text-muted-foreground/50" />
              </div>
              <p className="text-2xl font-bold text-[#2C1810] mb-2">{t("blog.noArticlesFound")}</p>
              <p className="text-muted-foreground mb-8 max-w-xs mx-auto">
                {t("blog.noPosts")}
              </p>
              <Button
                variant="outline"
                className="rounded-full border-[#B85C3C] text-[#B85C3C] hover:bg-[#B85C3C] hover:text-white px-8"
                onClick={() => {
                  setSearchQuery("");
                  setCurrentPage(1);
                }}
              >
                {t("blog.viewAllStories")}
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
