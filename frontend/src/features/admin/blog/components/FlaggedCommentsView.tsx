import { useFlaggedCommentsManagement } from "@/features/blog";
import { FlaggedCommentsTable } from "@/features/admin/blog";
import { ModerationHistoryViewer } from "@/features/admin/blog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";

export function FlaggedCommentsView() {
  const {
    t,
    searchQuery, setSearchQuery,
    page, setPage,
    statusFilter, setStatusFilter,
    selectedComment, setSelectedComment,
    actionType, setActionType,
    isActionOpen, setIsActionOpen,
    historyComment, setHistoryComment,
    totalPages,
    filteredComments,
    isLoading,
    isFetching,
    canBlockUsers,
    handleAction,
    totalFlags,
  } = useFlaggedCommentsManagement();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("admin.flaggedComments.title")}</h1>
          <p className="text-muted-foreground">{t("admin.flaggedComments.subtitle")}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.flaggedComments.cardTitle")}</CardTitle>
          <CardDescription>{t("admin.flaggedComments.cardDescription")}</CardDescription>
          <div className="flex items-center gap-4 mt-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="comment-search"
                placeholder={t("admin.flaggedComments.searchPlaceholder")}
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              {(["all", "active", "hidden", "deleted"] as const).map((filter) => (
                <Button
                  key={filter}
                  variant={statusFilter === filter ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setStatusFilter(filter); setPage(1); }}
                >
                  {filter === "all" ? t("common.all") : t(`comments.${filter}`)}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>{totalFlags} {t("admin.flaggedComments.flags")}</span>
            {isFetching && !isLoading ? <span>{t("comments.loading")}</span> : null}
          </div>
          
          <FlaggedCommentsTable
            comments={filteredComments}
            isLoading={isLoading}
            canBlockUsers={canBlockUsers}
            onViewHistory={setHistoryComment}
            onAction={(comment, type) => {
              setSelectedComment(comment);
              setActionType(type);
              setIsActionOpen(true);
            }}
          />

          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {totalPages > 0 ? `${t("common.page")} ${page} / ${totalPages}` : `${t("common.page")} 1 / 1`}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>{t("common.previous")}</Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={totalPages === 0 || page >= totalPages}>{t("common.next")}</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!historyComment} onOpenChange={(open) => !open && setHistoryComment(null)}>
        <DialogContent className="max-w-4xl" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{t("comments.admin.historyTitle")}</DialogTitle>
            <DialogDescription>{historyComment?.content}</DialogDescription>
          </DialogHeader>
          {historyComment ? <ModerationHistoryViewer commentId={historyComment.id} /> : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={isActionOpen && !!selectedComment} onOpenChange={(open) => {
        if (!open) { setSelectedComment(null); setActionType(null); }
        setIsActionOpen(open);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{actionType && t(`admin.flaggedComments.dialog.${actionType}Title`)}</AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === "delete" ? (
                <>
                  {t("admin.flaggedComments.dialog.deleteDesc")}
                  <div className="mt-4 p-4 bg-muted rounded-md text-sm italic">"{selectedComment?.content}"</div>
                </>
              ) : actionType === "block" || actionType === "unblock" ? (
                t(`admin.flaggedComments.dialog.${actionType}Desc`, {
                  firstName: selectedComment?.profiles?.first_name,
                  lastName: selectedComment?.profiles?.last_name,
                })
              ) : (
                actionType && t(`admin.flaggedComments.dialog.${actionType}Desc`)
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              className={actionType === "delete" || actionType === "block" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {actionType && t(`admin.flaggedComments.actions.${actionType}`)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
