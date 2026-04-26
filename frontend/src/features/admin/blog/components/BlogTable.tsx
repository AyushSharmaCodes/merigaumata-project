import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Edit, Trash2, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { stripHtml } from "@/core/utils/stringUtils";
import type { Blog } from "@/shared/types";

interface BlogTableProps {
  blogs: Blog[];
  onEdit: (blog: Blog) => void;
  onDelete: (blog: Blog) => void;
  onTogglePublish: (blog: Blog) => void;
}

export const BlogTable = ({
  blogs,
  onEdit,
  onDelete,
  onTogglePublish,
}: BlogTableProps) => {
  const { t } = useTranslation();

  return (
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
                    onClick={() => onTogglePublish(blog)}
                    title={blog.published ? t("admin.blogs.actions.unpublish") : t("admin.blogs.actions.publish")}
                  >
                    {blog.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onEdit(blog)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(blog)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
