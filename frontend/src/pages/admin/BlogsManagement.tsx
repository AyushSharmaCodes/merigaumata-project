import { logger } from "@/lib/logger";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tag } from "@/components/ui/Tag";
import {
  FileText,
  Search,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Plus,
  Loader2
} from "lucide-react";
import { BlogDialog } from "@/components/admin/BlogDialog";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import type { Blog } from "@/types";
import { format } from "date-fns";
import { blogService } from "@/services/blog.service";
import { uploadService } from "@/services/upload.service";
import { stripHtml } from "@/utils/stringUtils";
import { getBlogUploadFolder } from "@/utils/uploadFolders";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { AdminTableSkeleton } from "@/components/ui/page-skeletons";

export default function BlogsManagement() {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;

  const [blogDialogOpen, setBlogDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBlog, setSelectedBlog] = useState<Blog | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-blogs", page, limit, searchQuery, i18n.language],
    queryFn: async () => {
      return blogService.getPaginated(page, limit, searchQuery);
    },
  });

  const blogs = data?.blogs || [];
  const totalPages = data?.totalPages || 0;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  const blogMutation = useMutation({
    meta: { blocking: true },
    mutationFn: async (blogData: Partial<Blog> & { imageFile?: File; replacedImageUrl?: string }) => {
      const finalBlog = { ...blogData };

      // Handle image upload if file is present
      if (blogData.imageFile) {
        const response = await uploadService.uploadImage(
          blogData.imageFile,
          'blog',
          getBlogUploadFolder({
            title: finalBlog.title || selectedBlog?.title,
            title_i18n: finalBlog.title_i18n || selectedBlog?.title_i18n,
            blog_code: finalBlog.blog_code || selectedBlog?.blog_code
          })
        );
        finalBlog.image = response.url;
        // Remove imageFile from the object sent to API
        delete finalBlog.imageFile;
      }

      try {
        if (finalBlog.id) {
          return await blogService.update(finalBlog.id, finalBlog);
        } else {
          return await blogService.create(finalBlog as Omit<Blog, "id">);
        }
      } catch (error) {
        // Cleanup uploaded image if blog creation/update fails
        if (finalBlog.image && blogData.imageFile) {
          logger.warn("Blog save failed, cleaning up orphaned image", { uploadedImageUrl: finalBlog.image, error });
          try {
            await uploadService.deleteImageByUrl(finalBlog.image);
          } catch (cleanupError) {
            logger.error("Failed to cleanup orphaned blog image", { cleanupError, uploadedImageUrl: finalBlog.image });
          }
        }
        throw error;
      }
    },
    onSuccess: async (_data, variables) => {
      if (variables.replacedImageUrl) {
        try {
          await uploadService.deleteImageByUrl(variables.replacedImageUrl);
        } catch (cleanupError) {
          logger.error("Failed to cleanup replaced blog image", { cleanupError, replacedImageUrl: variables.replacedImageUrl });
        }
      }
      queryClient.invalidateQueries({ queryKey: ["admin-blogs"] });
      toast({
        title: t("common.success"),
        description: selectedBlog
          ? t("admin.blogs.toasts.updateSuccess")
          : t("admin.blogs.toasts.createSuccess"),
      });
      setBlogDialogOpen(false);
      setSelectedBlog(null);
    },
    onError: (error: unknown) => {
      toast({
        title: t("common.error"),
        description: getErrorMessage(error, t, "admin.blogs.toasts.saveError"),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    meta: { blocking: true },
    mutationFn: async (blogId: string) => {
      await blogService.delete(blogId);
      return blogId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-blogs"] });
      toast({
        title: t("common.success"),
        description: t("admin.blogs.toasts.deleteSuccess"),
      });
      setDeleteDialogOpen(false);
      setSelectedBlog(null);
    },
    onError: (error: unknown) => {
      toast({
        title: t("common.error"),
        description: getErrorMessage(error, t, "admin.blogs.toasts.deleteError"),
        variant: "destructive",
      });
    },
  });

  const togglePublishMutation = useMutation({
    meta: { blocking: true },
    mutationFn: async ({
      id,
      published,
    }: {
      id: string;
      published: boolean;
    }) => {
      await blogService.update(id, { published });
      return { id, published };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-blogs"] });
      toast({
        title: t("common.success"),
        description: t("admin.blogs.toasts.statusSuccess"),
      });
    },
    onError: (error: unknown) => {
      toast({
        title: t("common.error"),
        description: getErrorMessage(error, t, "admin.blogs.toasts.statusError"),
        variant: "destructive",
      });
    },
  });

  const handleAddBlog = () => {
    setSelectedBlog(null);
    setBlogDialogOpen(true);
  };

  const handleEditBlog = (blog: Blog) => {
    setSelectedBlog(blog);
    setBlogDialogOpen(true);
  };

  const handleDeleteBlog = (blog: Blog) => {
    setSelectedBlog(blog);
    setDeleteDialogOpen(true);
  };

  const handleSaveBlog = (blog: Partial<Blog> & { imageFile?: File }) => {
    blogMutation.mutate(blog);
  };

  const handleConfirmDelete = () => {
    if (selectedBlog) {
      deleteMutation.mutate(selectedBlog.id);
    }
  };

  const handleTogglePublish = (blog: Blog) => {
    togglePublishMutation.mutate({
      id: blog.id,
      published: !blog.published,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t("admin.blogs.title")}</h2>
          <p className="text-muted-foreground">{t("admin.blogs.subtitle") || "Create and moderate stories, recipes, and news"}</p>
        </div>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 pb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-xl">
              <FileText className="h-5 w-5 text-primary" />
              {t("admin.blogs.allBlogs", { count: blogs.length })}
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="blog-admin-search"
                  name="search"
                  placeholder={t("admin.blogs.searchPlaceholder")}
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="pl-9 h-10 border-muted-foreground/20 focus:border-primary transition-all shadow-none"
                />
              </div>
              <Button onClick={handleAddBlog} className="h-10 px-6 shadow-sm shadow-primary/20">
                <Plus className="h-4 w-4 mr-2" />
                {t("admin.blogs.add")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <AdminTableSkeleton columns={5} />
          ) : blogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t("admin.blogs.noFound")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.blogs.table.post")}</TableHead>
                    <TableHead>{t("admin.blogs.table.author")}</TableHead>
                    <TableHead>{t("admin.blogs.table.date")}</TableHead>
                    <TableHead>{t("admin.blogs.table.status")}</TableHead>
                    <TableHead className="text-right">{t("admin.blogs.table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blogs.map((blog) => (
                    <TableRow key={blog.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {blog.image && (
                            <img
                              src={blog.image}
                              alt={blog.title}
                              loading="lazy"
                              className="w-16 h-16 rounded object-cover"
                            />
                          )}
                          <div className="max-w-md group">
                            <p className="font-bold text-base leading-tight group-hover:text-primary transition-colors">
                              {blog.title}
                            </p>
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {stripHtml(blog.excerpt)}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-muted-foreground">{blog.author}</TableCell>
                      <TableCell className="text-sm text-muted-foreground font-mono">
                        {format(new Date(blog.date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={blog.published ? "default" : "secondary"}
                          className={blog.published ? "bg-green-100 text-green-700 hover:bg-green-200 border-none px-3" : "bg-muted text-muted-foreground border-none px-3"}
                        >
                          {blog.published ? t("admin.blogs.status.published") : t("admin.blogs.status.draft")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleTogglePublish(blog)}
                            title={blog.published ? t("admin.blogs.actions.unpublish") : t("admin.blogs.actions.publish")}
                          >
                            {blog.published ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditBlog(blog)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteBlog(blog)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 0 && (
        <div className="flex flex-col items-center gap-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (page > 1) setPage(page - 1);
                  }}
                  className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>

              {/* Show only logical range of pages if many pages exist, otherwise all */}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <PaginationItem key={p}>
                  <PaginationLink
                    href="#"
                    isActive={page === p}
                    onClick={(e) => {
                      e.preventDefault();
                      setPage(p);
                    }}
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              ))}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (page < totalPages) setPage(page + 1);
                  }}
                  className={page >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
          <p className="text-sm text-muted-foreground">
            {t("admin.blogs.pagination", { current: page, total: totalPages })}
          </p>
        </div>
      )}

      <BlogDialog
        open={blogDialogOpen}
        onOpenChange={setBlogDialogOpen}
        blog={selectedBlog}
        onSave={handleSaveBlog}
        isLoading={blogMutation.isPending}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t("admin.blogs.delete.title")}
        description={t("admin.blogs.delete.desc", { title: selectedBlog?.title })}
        onConfirm={handleConfirmDelete}
      />


    </div>
  );
}
