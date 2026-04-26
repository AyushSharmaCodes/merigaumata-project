import { useBlogsManagement, BlogTable } from "@/features/admin/blog";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { FileText, Search, Plus } from "lucide-react";
import { BlogDialog } from "@/features/admin/blog";
import { DeleteConfirmDialog } from "@/features/admin";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/shared/components/ui/pagination";
import { AdminTableSkeleton } from "@/shared/components/ui/page-skeletons";

export default function BlogsManagement() {
  const {
    t,
    searchQuery, setSearchQuery,
    page, setPage,
    blogs, totalPages,
    isLoading,
    blogDialogOpen, setBlogDialogOpen,
    deleteDialogOpen, setDeleteDialogOpen,
    selectedBlog, setSelectedBlog,
    blogMutation,
    deleteMutation,
    togglePublishMutation,
  } = useBlogsManagement();

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
                  placeholder={t("admin.blogs.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  className="pl-9 h-10 border-muted-foreground/20 focus:border-primary transition-all shadow-none"
                />
              </div>
              <Button onClick={() => { setSelectedBlog(null); setBlogDialogOpen(true); }} className="h-10 px-6 shadow-sm shadow-primary/20">
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
            <BlogTable
              blogs={blogs}
              onEdit={(blog) => { setSelectedBlog(blog); setBlogDialogOpen(true); }}
              onDelete={(blog) => { setSelectedBlog(blog); setDeleteDialogOpen(true); }}
              onTogglePublish={(blog) => togglePublishMutation.mutate({ id: blog.id, published: !blog.published })}
            />
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
                  onClick={(e) => { e.preventDefault(); if (page > 1) setPage(page - 1); }}
                  className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <PaginationItem key={p}>
                  <PaginationLink href="#" isActive={page === p} onClick={(e) => { e.preventDefault(); setPage(p); }}>{p}</PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => { e.preventDefault(); if (page < totalPages) setPage(page + 1); }}
                  className={page >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
          <p className="text-sm text-muted-foreground">{t("admin.blogs.pagination", { current: page, total: totalPages })}</p>
        </div>
      )}

      <BlogDialog
        open={blogDialogOpen}
        onOpenChange={setBlogDialogOpen}
        blog={selectedBlog}
        onSave={(blog) => blogMutation.mutate(blog)}
        isLoading={blogMutation.isPending}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t("admin.blogs.delete.title")}
        description={t("admin.blogs.delete.desc", { title: selectedBlog?.title })}
        onConfirm={() => selectedBlog && deleteMutation.mutate(selectedBlog.id)}
      />
    </div>
  );
}
