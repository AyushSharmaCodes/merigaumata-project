import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tag, Search, Edit, Trash2, Plus, Info } from "lucide-react";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { categoryService, Category } from "@/services/category.service";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getLocalizedContent } from "@/utils/localizationUtils";

export default function EventCategoriesManagement() {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  );
  const [categoryName, setCategoryName] = useState("");
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["admin-event-categories", searchQuery, i18n.language],
    queryFn: async () => {
      // Fetch all event categories
      const allCategories = await categoryService.getAll("event");
      return allCategories.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    },
  });

  const categoryMutation = useMutation({
    mutationFn: async ({ id, name }: { id?: string; name: string }) => {
      if (id) {
        return categoryService.update(id, { name });
      } else {
        return categoryService.create({ name, type: "event" });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-event-categories"] });
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      toast({
        title: t("common.success"),
        description: selectedCategory
          ? t("admin.events.categories.toasts.updated")
          : t("admin.events.categories.toasts.created"),
      });
      setCategoryDialogOpen(false);
      setSelectedCategory(null);
      setCategoryName("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await categoryService.delete(id);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-event-categories"] });
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      toast({
        title: t("common.success"),
        description: t("admin.events.categories.toasts.deleted"),
      });
      setDeleteDialogOpen(false);
      setSelectedCategory(null);
    },
  });

  const handleAddCategory = () => {
    setSelectedCategory(null);
    setCategoryName("");
    setCategoryDialogOpen(true);
  };

  const handleEditCategory = (category: Category) => {
    setSelectedCategory(category);
    setCategoryName(category.name);
    setCategoryDialogOpen(true);
  };

  const handleDeleteCategory = (category: Category) => {
    setSelectedCategory(category);
    setDeleteDialogOpen(true);
  };

  const handleSaveCategory = () => {
    if (!categoryName.trim()) {
      toast({
        title: t("common.error"),
        description: t("admin.events.dialogs.namePlaceholder"),
        variant: "destructive",
      });
      return;
    }

    categoryMutation.mutate({
      id: selectedCategory?.id,
      name: categoryName,
    });
  };

  const handleConfirmDelete = () => {
    if (selectedCategory) {
      deleteMutation.mutate(selectedCategory.id);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          {t("admin.events.categories.title")}
        </h2>
        <p className="text-muted-foreground">
          {t("admin.events.categories.subtitle")}
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          {t("admin.events.categories.notice")}
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              {t("admin.events.categories.allCategories")} ({categories.length})
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("admin.events.categories.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button onClick={handleAddCategory}>
                <Plus className="h-4 w-4 mr-2" />
                {t("admin.events.categories.addCategory")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">{t("admin.events.categories.loading")}</div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t("admin.events.categories.noCategories")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.events.categories.table.name")}</TableHead>
                    <TableHead>{t("admin.blog.table.date")}</TableHead>
                    <TableHead className="text-right">{t("admin.events.management.table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {getLocalizedContent(category, i18n.language)}
                            {/* Show original name in small text if different and not default lang */}
                            {i18n.language !== 'en' && category.name !== getLocalizedContent(category, i18n.language) && (
                              <span className="ml-2 text-xs text-muted-foreground">({category.name})</span>
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(category.createdAt), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditCategory(category)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteCategory(category)}
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

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedCategory
                ? t("admin.events.categories.dialog.editTitle")
                : t("admin.events.categories.dialog.addTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="categoryName">
                {t("admin.events.categories.dialog.nameLabel")} <span className="text-red-600">*</span>
              </Label>
              <Input
                id="categoryName"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder={t("admin.events.categories.dialog.namePlaceholder")}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleSaveCategory();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                {t("admin.events.categories.dialog.adminOnly")}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCategoryDialogOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSaveCategory}>
              {selectedCategory ? t("common.update") : t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t("admin.events.categories.delete.title")}
        description={t("admin.events.categories.delete.desc", { name: selectedCategory?.name })}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
