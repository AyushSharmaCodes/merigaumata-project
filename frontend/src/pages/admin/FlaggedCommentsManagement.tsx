import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { commentService } from "@/services/comment.service";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/authStore";
import { ModerationHistoryViewer } from "@/components/comments/admin/ModerationHistoryViewer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Trash2, ShieldCheck, Search, UserX, EyeOff, ExternalLink, History } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { Comment } from "@/types/comment";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeInvalidation";


export default function FlaggedCommentsManagement() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "hidden" | "deleted">("active");
  const [selectedComment, setSelectedComment] = useState<Comment | null>(null);
  const [actionType, setActionType] = useState<"dismiss" | "delete" | "block" | "unblock" | "approve" | "hide" | null>(null);
  const [isActionOpen, setIsActionOpen] = useState(false);
  const [historyComment, setHistoryComment] = useState<Comment | null>(null);
  const PAGE_SIZE = 20;
  const canBlockUsers = user?.role === "admin";

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["flagged-comments", page, statusFilter],
    queryFn: () => commentService.getFlaggedComments(page, PAGE_SIZE, statusFilter),
  });

  const flaggedComments = data?.comments || [];
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages || 0;

  useRealtimeInvalidation(["comments"], [["flagged-comments"]]);

  const resolveMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "hide" }) => {
      if (action === "approve") {
        return commentService.approveComment(id);
      } else {
        return commentService.hideComment(id);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["flagged-comments"] });
      toast({
        title: t("common.success"),
        description: variables.action === "hide" ? t("admin.flaggedComments.toasts.hideSuccess") : t("admin.flaggedComments.toasts.approveSuccess"),
      });
      setActionType(null);
      setSelectedComment(null);
      setIsActionOpen(false);
    },
    onError: (error: unknown) => {
      toast({
        title: t("common.error"),
        description: getErrorMessage(error, t, "admin.flaggedComments.toasts.resolveError"),
        variant: "destructive",
      });
    },
  });

  const deletePermanentlyMutation = useMutation({
    mutationFn: (id: string) => commentService.deleteCommentPermanently(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flagged-comments"] });
      toast({
        title: t("common.success"),
        description: t("admin.flaggedComments.toasts.deleteSuccess"),
      });
      setActionType(null);
      setSelectedComment(null);
      setIsActionOpen(false);
    },
    onError: (error: unknown) => {
      toast({
        title: t("common.error"),
        description: getErrorMessage(error, t, "admin.flaggedComments.toasts.deleteError"),
        variant: "destructive",
      });
    },
  });

  const blockUserMutation = useMutation({
    mutationFn: (userId: string) => apiClient.post(`/users/${userId}/block`, { isBlocked: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flagged-comments"] });
      toast({
        title: t("common.success"),
        description: t("admin.flaggedComments.toasts.blockSuccess"),
      });
      setActionType(null);
      setSelectedComment(null);
      setIsActionOpen(false);
    },
    onError: (error: unknown) => {
      toast({
        title: t("common.error"),
        description: getErrorMessage(error, t, "admin.flaggedComments.toasts.blockError"),
        variant: "destructive",
      });
    },
  });

  const unblockUserMutation = useMutation({
    mutationFn: (userId: string) => apiClient.post(`/users/${userId}/block`, { isBlocked: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flagged-comments"] });
      toast({
        title: t("common.success"),
        description: t("admin.flaggedComments.toasts.unblockSuccess"),
      });
      setActionType(null);
      setSelectedComment(null);
      setIsActionOpen(false);
    },
    onError: (error: unknown) => {
      toast({
        title: t("common.error"),
        description: getErrorMessage(error, t, "admin.flaggedComments.toasts.unblockError"),
        variant: "destructive",
      });
    },
  });

  const filteredComments = flaggedComments.filter(
    (comment) =>
      comment.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comment.profiles?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comment.profiles?.last_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAction = () => {
    if (selectedComment && actionType) {
      if (actionType === "block") {
        blockUserMutation.mutate(selectedComment.user_id);
      } else if (actionType === "unblock") {
        unblockUserMutation.mutate(selectedComment.user_id);
      } else if (actionType === "delete") {
        deletePermanentlyMutation.mutate(selectedComment.id);
      } else if (actionType === "approve" || actionType === "dismiss") {
        resolveMutation.mutate({ id: selectedComment.id, action: "approve" });
      } else if (actionType === "hide") {
        resolveMutation.mutate({ id: selectedComment.id, action: "hide" });
      }
    }
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "U";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("admin.flaggedComments.title")}</h1>
          <p className="text-muted-foreground">
            {t("admin.flaggedComments.subtitle")}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.flaggedComments.cardTitle")}</CardTitle>
          <CardDescription>
            {t("admin.flaggedComments.cardDescription")}
          </CardDescription>
          <div className="flex items-center gap-4 mt-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="comment-search"
                name="search"
                placeholder={t("admin.flaggedComments.searchPlaceholder")}
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={statusFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setStatusFilter("all");
                  setPage(1);
                }}
              >
                {t("common.all")}
              </Button>
              <Button
                variant={statusFilter === "active" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setStatusFilter("active");
                  setPage(1);
                }}
              >
                {t("comments.active")}
              </Button>
              <Button
                variant={statusFilter === "hidden" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setStatusFilter("hidden");
                  setPage(1);
                }}
              >
                {t("comments.hidden")}
              </Button>
              <Button
                variant={statusFilter === "deleted" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setStatusFilter("deleted");
                  setPage(1);
                }}
              >
                {t("comments.deleted")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {pagination?.total || 0} {t("admin.flaggedComments.flags")}
            </span>
            {isFetching && !isLoading ? <span>{t("comments.loading")}</span> : null}
          </div>
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
                  <TableCell colSpan={7} className="text-center py-8">
                    {t("admin.flaggedComments.loading")}
                  </TableCell>
                </TableRow>
              ) : filteredComments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    {t("admin.flaggedComments.noComments")}
                  </TableCell>
                </TableRow>
              ) : (
                filteredComments.map((comment) => (
                  <TableRow key={comment.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={comment.profiles?.avatar_url} />
                          <AvatarFallback>
                            {getInitials(comment.profiles?.first_name, comment.profiles?.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">
                          {comment.profiles?.first_name} {comment.profiles?.last_name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <p className="truncate" title={comment.content}>
                        {comment.content}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="flex items-center gap-1">
                        <p className="truncate" title={comment.blog_id}>
                          {comment.blog_id.slice(0, 8)}...
                        </p>
                        <Link
                          to={`/blog/${comment.blog_id}`}
                          target="_blank"
                          className="text-primary hover:text-primary/80"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                        {comment.flag_reason || t("common.unknown")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {comment.flag_count} {t("admin.flaggedComments.flags")}
                    </TableCell>
                    <TableCell>
                      {format(new Date(comment.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-slate-600 hover:text-slate-700 hover:bg-slate-50"
                          onClick={() => setHistoryComment(comment)}
                          title={t("comments.admin.historyTitle")}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => {
                            setSelectedComment(comment);
                            setActionType("approve");
                            setIsActionOpen(true);
                          }}
                          title={t("admin.flaggedComments.actions.approve")}
                        >
                          <ShieldCheck className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                          onClick={() => {
                            setSelectedComment(comment);
                            setActionType("hide");
                            setIsActionOpen(true);
                          }}
                          title={t("admin.flaggedComments.actions.hide")}
                        >
                          <EyeOff className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setSelectedComment(comment);
                            setActionType("delete");
                            setIsActionOpen(true);
                          }}
                          title={t("admin.flaggedComments.actions.delete")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                          disabled={!canBlockUsers}
                          onClick={() => {
                            setSelectedComment(comment);
                            setActionType("block");
                            setIsActionOpen(true);
                          }}
                          title={t("admin.flaggedComments.actions.block")}
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
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {totalPages > 0
                ? `${t("common.page")} ${page} / ${totalPages}`
                : `${t("common.page")} 1 / 1`}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
              >
                {t("common.previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => current + 1)}
                disabled={totalPages === 0 || page >= totalPages}
              >
                {t("common.next")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!historyComment} onOpenChange={(open) => !open && setHistoryComment(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t("comments.admin.historyTitle")}</DialogTitle>
            <DialogDescription>
              {historyComment?.content}
            </DialogDescription>
          </DialogHeader>
          {historyComment ? <ModerationHistoryViewer commentId={historyComment.id} /> : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={isActionOpen && !!selectedComment} onOpenChange={(open) => {
        if (!open) {
          setSelectedComment(null);
          setActionType(null);
        }
        setIsActionOpen(open);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "delete"
                ? t("admin.flaggedComments.dialog.deleteTitle")
                : actionType === "block"
                  ? t("admin.flaggedComments.dialog.blockTitle")
                  : actionType === "unblock"
                    ? t("admin.flaggedComments.dialog.unblockTitle")
                    : actionType === "hide"
                      ? t("admin.flaggedComments.dialog.hideTitle")
                      : t("admin.flaggedComments.dialog.approveTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === "delete" ? (
                <>
                  {t("admin.flaggedComments.dialog.deleteDesc")}
                  <div className="mt-4 p-4 bg-muted rounded-md text-sm italic">
                    "{selectedComment?.content}"
                  </div>
                </>
              ) : actionType === "block" ? (
                t("admin.flaggedComments.dialog.blockDesc", {
                  firstName: selectedComment?.profiles?.first_name,
                  lastName: selectedComment?.profiles?.last_name,
                })
              ) : actionType === "unblock" ? (
                t("admin.flaggedComments.dialog.unblockDesc", {
                  firstName: selectedComment?.profiles?.first_name,
                  lastName: selectedComment?.profiles?.last_name,
                })
              ) : actionType === "hide" ? (
                t("admin.flaggedComments.dialog.hideDesc")
              ) : (
                t("admin.flaggedComments.dialog.approveDesc")
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              className={actionType === "delete" || actionType === "block" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {actionType === "delete"
                ? t("admin.flaggedComments.actions.delete")
                : actionType === "block"
                  ? t("admin.flaggedComments.actions.block")
                  : actionType === "unblock"
                    ? t("admin.flaggedComments.actions.unblock")
                    : actionType === "hide"
                      ? t("admin.flaggedComments.actions.hide")
                      : t("admin.flaggedComments.actions.approve")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
