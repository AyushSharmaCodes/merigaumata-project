import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { blogApi } from "@/domains/content";
import { useMetaTags } from "@/shared/hooks/useMetaTags";

export function useBlogPostPage() {
  const { postId } = useParams<{ postId: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  // Fetch blog post from database
  const { data: post, isLoading } = useQuery({
    queryKey: ["blog", postId, i18n.language],
    queryFn: () => blogApi.getById(postId || ""),
    enabled: !!postId,
  });

  // Fetch all blogs for related posts
  const { data: allBlogs = [] } = useQuery({
    queryKey: ["blogs", i18n.language],
    queryFn: () => blogApi.getAll(),
  });

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

  // Get related posts from the same tags/category
  const relatedPosts = allBlogs
    .filter((blog) =>
      blog.id !== post?.id &&
      blog.published &&
      blog.tags?.some(tag => post?.tags?.includes(tag))
    )
    .slice(0, 3);

  return {
    postId,
    post,
    isLoading,
    relatedPosts,
    t,
    i18n,
    navigate,
  };
}
