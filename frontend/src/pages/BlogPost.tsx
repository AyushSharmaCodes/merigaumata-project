import { useParams, Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, User, Calendar, Tag, Share2 } from "lucide-react";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/BackButton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tag as TagComponent } from "@/components/ui/Tag";
import { Separator } from "@/components/ui/separator";

import { SocialShare } from "@/components/SocialShare";
import { useMetaTags } from "@/hooks/useMetaTags";
import { BlogComments } from "@/components/BlogComments";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeInvalidation";
import { blogService } from "@/services/blog.service";
import type { Blog } from "@/types";
import { LoadingOverlay } from "@/components/ui/loading-overlay";

export default function BlogPost() {
  const { postId } = useParams<{ postId: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  // Fetch blog post from database
  const { data: post, isLoading } = useQuery({
    queryKey: ["blog", postId, i18n.language],
    queryFn: () => blogService.getById(postId || ""),
    enabled: !!postId,
  });

  // Fetch all blogs for related posts
  const { data: allBlogs = [] } = useQuery({
    queryKey: ["blogs", i18n.language],
    queryFn: blogService.getAll,
  });

  useRealtimeInvalidation(
    ["blogs", "comments"],
    [["blog", postId], ["blogs"], ["comments", postId]],
    !!postId,
  );

  // Update meta tags for social sharing
  useMetaTags({
    title: post?.title,
    description: post?.excerpt,
    image: post?.image,
    url: `/blog/${postId}`,
    type: "article",
    author: post?.author,
    publishedTime: post?.date ? new Date(post.date).toISOString() : undefined,
    tags: post?.tags,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] relative">
        <LoadingOverlay message={t("blog.justAMoment")} isLoading={true} />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-[#2C1810] mb-4">{t("blog.notFound")}</h1>
          <BackButton to="/blog" label={t("blog.backToBlog")} />
        </div>
      </div>
    );
  }

  // Get related posts from the same tags/category
  const relatedPosts = allBlogs
    .filter((blog) =>
      blog.id !== post.id &&
      blog.published &&
      blog.tags?.some(tag => post.tags?.includes(tag))
    )
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      {/* Hero Section */}
      <div className="relative h-[50vh] min-h-[400px] max-h-[600px] w-full overflow-hidden">
        <img
          src={post.image}
          alt={post.title}
          loading="lazy"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#2C1810]/80 via-[#2C1810]/40 to-transparent" />

        {/* Back Button on Hero */}
        <div className="absolute top-6 left-0 right-0">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <BackButton
              to="/blog"
              label={t("blog.backToBlog")}
              className="bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20"
            />
          </div>
        </div>

        {/* Hero Content */}
        <div className="absolute bottom-0 left-0 right-0 pb-10">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              {/* Tags */}
              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {post.tags.slice(0, 3).map((tag, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-[#B85C3C] text-white text-[10px] font-bold uppercase tracking-wider rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Title */}
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-6 font-playfair leading-tight">
                {post.title}
              </h1>

              {/* Meta Info */}
              <div className="flex flex-wrap items-center gap-4 text-white/80 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#B85C3C] flex items-center justify-center">
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <span className="font-medium text-white">{post.author}</span>
                </div>
                <span className="text-white/40">•</span>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  <span>{new Date(post.date).toLocaleDateString(i18n.language, { month: 'long', day: '2-digit', year: 'numeric' })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Article Content */}
      <article className="py-12 lg:py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            {/* Excerpt / Lead Paragraph */}
            <p className="text-xl lg:text-2xl text-[#2C1810]/70 mb-10 leading-relaxed font-light border-l-4 border-[#B85C3C] pl-6">
              {post.excerpt}
            </p>

            {/* Article Content */}
            <div
              className="prose prose-lg max-w-none
                prose-headings:font-bold prose-headings:text-[#2C1810] prose-headings:font-playfair
                prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
                prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
                prose-p:text-[#2C1810]/70 prose-p:leading-relaxed prose-p:mb-5
                prose-strong:text-[#2C1810]
                prose-a:text-[#B85C3C] prose-a:no-underline hover:prose-a:underline
                prose-ul:my-4 prose-li:text-[#2C1810]/70
                prose-blockquote:border-l-4 prose-blockquote:border-[#B85C3C] prose-blockquote:bg-[#B85C3C]/5 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:not-italic
                prose-img:rounded-2xl prose-img:shadow-lg"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content) }}
            />

            <Separator className="my-10 bg-[#B85C3C]/10" />

            {/* Tags Section */}
            <div className="flex items-center gap-3 flex-wrap">
              <Tag className="h-4 w-4 text-[#B85C3C]" />
              <div className="flex flex-wrap gap-2">
                {post.tags?.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-white border border-[#B85C3C]/20 text-[#B85C3C] text-xs font-bold uppercase tracking-wider rounded-full hover:bg-[#B85C3C] hover:text-white transition-colors cursor-pointer"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Social Share */}
            <div className="mt-10 p-6 bg-white rounded-2xl border border-[#B85C3C]/10 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Share2 className="h-4 w-4 text-[#B85C3C]" />
                <span className="text-xs font-bold uppercase tracking-widest text-[#2C1810]">{t("blog.shareThis")}</span>
              </div>
              <SocialShare
                url={`/blog/${postId}`}
                title={post.title}
                description={post.excerpt}
              />
            </div>

            {/* Comments Section */}
            <div className="mt-12">
              <BlogComments blogId={postId || ""} />
            </div>
          </div>
        </div>
      </article>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-10">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#B85C3C] mb-2 block">
                  {t("blog.continueReading")}
                </span>
                <h2 className="text-2xl lg:text-3xl font-bold text-[#2C1810] font-playfair">
                  {t("blog.relatedPosts")}
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {relatedPosts.map((relatedPost) => (
                  <Link key={relatedPost.id} to={`/blog/${relatedPost.id}`}>
                    <Card className="h-full overflow-hidden border-none shadow-lg hover:shadow-xl transition-all duration-300 bg-[#FAF7F2] group">
                      <div className="aspect-video overflow-hidden">
                        <img
                          src={relatedPost.image}
                          alt={relatedPost.title}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      </div>
                      <CardHeader className="pb-2">
                        {relatedPost.tags && relatedPost.tags.length > 0 && (
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[#B85C3C] mb-1">
                            {relatedPost.tags[0]}
                          </span>
                        )}
                        <CardTitle className="text-base font-bold text-[#2C1810] line-clamp-2 group-hover:text-[#B85C3C] transition-colors">
                          {relatedPost.title}
                        </CardTitle>
                        <CardDescription className="text-xs text-[#2C1810]/60 line-clamp-2">
                          {relatedPost.excerpt}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex items-center gap-1.5 text-[10px] text-[#2C1810]/50">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(relatedPost.date).toLocaleDateString(i18n.language, { month: 'short', day: '2-digit', year: 'numeric' })}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
