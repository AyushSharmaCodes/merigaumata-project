import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Search,
  Clock,
  User,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/shared/components/ui/carousel";
import { BlogSkeleton } from "@/shared/components/ui/page-skeletons";
import { useBlogPage } from "../hooks/useBlogPage";

export function BlogPage() {
  const {
    t,
    i18n,
    searchQuery,
    featuredPosts,
    paginatedPosts,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    handleSearchChange,
    handleResetSearch,
    fetchNextPage,
  } = useBlogPage();

  if (isLoading && paginatedPosts.length === 0) {
    return <BlogSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background pb-20 animate-in fade-in duration-700">
      {/* Premium Compact Hero Section */}
      <section className="bg-foreground text-background py-12 md:py-20 relative overflow-hidden shadow-elevated">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <BookOpen className="h-64 w-64 text-primary" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.3em] backdrop-blur-md border border-primary/20">
                <Sparkles className="h-3 w-3" /> {t("blog.wisdom")}
              </div>
              <h1 className="text-4xl md:text-6xl font-black font-playfair tracking-tight">
                {t("blog.title")} <span className="text-primary">{t("blog.journal")}</span>
              </h1>
            </div>
            <p className="text-background/60 text-base md:text-lg max-w-md font-medium border-l-2 border-primary/30 pl-8 hidden md:block leading-relaxed">
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
              <h2 className="text-2xl font-bold font-playfair text-foreground">
                {t("blog.featuredHighlightsPart1")} <span className="text-primary">{t("blog.featuredHighlightsPart2")}</span>
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
                {paginatedPosts.map((post, index) => (
                  <Link 
                    key={post.id} 
                    to={`/blog/${post.id}`} 
                    className="group animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <Card className="h-full overflow-hidden border-none shadow-soft hover:shadow-elevated transition-all duration-500 rounded-[2rem] bg-white ring-1 ring-border/50 group-hover:ring-primary/20">
                      <div className="aspect-[16/10] overflow-hidden relative">
                        <img
                          src={post.image}
                          alt={post.title}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute top-4 left-4">
                          {post.tags && post.tags.length > 0 && (
                            <Badge className="bg-white/95 backdrop-blur-sm text-foreground hover:bg-primary hover:text-background transition-all border-none rounded-full px-3 py-1 text-[10px] uppercase tracking-widest font-black shadow-sm">
                              {post.tags[0]}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <CardHeader className="space-y-4">
                        <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            {new Date(post.date).toLocaleDateString(i18n.language, { month: 'short', day: '2-digit', year: 'numeric' })}
                          </span>
                        </div>
                        <CardTitle className="text-xl font-bold font-playfair text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors duration-300">
                          {post.title}
                        </CardTitle>
                        <CardDescription className="line-clamp-3 text-muted-foreground/80 leading-relaxed font-medium">
                          {post.excerpt}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0 pb-6">
                        <div className="flex items-center justify-between pt-4 border-t border-border/30">
                          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                            <User className="h-3.5 w-3.5 text-primary" />
                            <span>{post.author}</span>
                          </div>
                          <ArrowRight className="h-4 w-4 text-primary translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>

              {/* Load More Button */}
              {hasNextPage && (
                <div className="flex items-center justify-center mt-20">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="rounded-full px-12 h-14 text-lg font-bold border-[#B85C3C] text-[#B85C3C] hover:bg-[#B85C3C] hover:text-white transition-all shadow-xl disabled:opacity-50"
                  >
                    {isFetchingNextPage ? t("common.loading") || "Loading..." : t("common.loadMore") || "Load More"}
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
                onClick={handleResetSearch}
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
