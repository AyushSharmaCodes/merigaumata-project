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
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { Trash2, ShieldCheck, UserX, EyeOff, ExternalLink, History } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Comment } from "@/domains/content/model/comment.types";

interface FlaggedCommentsTableProps {
  comments: Comment[];
  isLoading: boolean;
  canBlockUsers: boolean;
  onViewHistory: (comment: Comment) => void;
  onAction: (comment: Comment, type: "approve" | "hide" | "delete" | "block") => void;
}

export const FlaggedCommentsTable = ({
  comments,
  isLoading,
  canBlockUsers,
  onViewHistory,
  onAction,
}: FlaggedCommentsTableProps) => {
  const { t } = useTranslation();

  const getInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "U";
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("admin.flaggedComments.table.cols.user")}</TableHead>
          <TableHead>{t("admin.flaggedComments.table.cols.comment")}</TableHead>
          <TableHead>{t("admin.flaggedComments.table.cols.blogPost")}</TableHead>
          <TableHead>{t("admin.flaggedComments.table.cols.reason")}</TableHead>
          <TableHead>{t("admin.flaggedComments.table.cols.flaggedBy")}</TableHead>
          <TableHead>{t("admin.flaggedComments.table.cols.date")}</TableHead>
          <TableHead className="text-right">{t("admin.flaggedComments.table.cols.actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-8">{t("admin.flaggedComments.loading")}</TableCell>
          </TableRow>
        ) : comments.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-8">{t("admin.flaggedComments.noComments")}</TableCell>
          </TableRow>
        ) : (
          comments.map((comment) => (
            <TableRow key={comment.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={comment.profiles?.avatar_url} />
                    <AvatarFallback>{getInitials(comment.profiles?.first_name, comment.profiles?.last_name)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{comment.profiles?.first_name} {comment.profiles?.last_name}</span>
                </div>
              </TableCell>
              <TableCell className="max-w-[300px]">
                <p className="truncate" title={comment.content}>{comment.content}</p>
              </TableCell>
              <TableCell className="max-w-[200px]">
                <div className="flex items-center gap-1">
                  <p className="truncate" title={comment.blog_id}>{comment.blog_id.slice(0, 8)}...</p>
                  <Link to={`/blog/${comment.blog_id}`} target="_blank" className="text-primary hover:text-primary/80">
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  {comment.flag_reason || t("common.unknown")}
                </Badge>
              </TableCell>
              <TableCell>{comment.flag_count} {t("admin.flaggedComments.flags")}</TableCell>
              <TableCell>{format(new Date(comment.created_at), "MMM d, yyyy")}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-600 hover:text-slate-700 hover:bg-slate-50"
                    onClick={() => onViewHistory(comment)} title={t("comments.admin.historyTitle")}
                  >
                    <History className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost" size="sm" className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => onAction(comment, "approve")} title={t("admin.flaggedComments.actions.approve")}
                  >
                    <ShieldCheck className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost" size="sm" className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                    onClick={() => onAction(comment, "hide")} title={t("admin.flaggedComments.actions.hide")}
                  >
                    <EyeOff className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => onAction(comment, "delete")} title={t("admin.flaggedComments.actions.delete")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost" size="sm" className="h-8 w-8 p-0 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                    disabled={!canBlockUsers} onClick={() => onAction(comment, "block")} title={t("admin.flaggedComments.actions.block")}
                  >
                    <UserX className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
};
