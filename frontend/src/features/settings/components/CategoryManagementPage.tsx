import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { Folder, Search, Edit, Trash2, Plus } from "lucide-react";
import { DeleteConfirmDialog } from "@/features/admin";
import { format } from "date-fns";
import { getLocalizedContent } from "@/core/utils/localizationUtils";
import { useCategoryManagement } from "../hooks/useCategoryManagement";
import { CategoryType } from "@/domains/settings/model/settings.types";

interface CategoryManagementPageProps {
    type?: CategoryType;
}

export const CategoryManagementPage = ({ type }: CategoryManagementPageProps) => {
    const {
        t,
        i18n,
        searchQuery,
        setSearchQuery,
        categoryDialogOpen,
        setCategoryDialogOpen,
        deleteDialogOpen,
        setDeleteDialogOpen,
        selectedCategory,
        categoryName,
        setCategoryName,
        categories,
        isLoading,
        handleAddCategory,
        handleEditCategory,
        handleDeleteCategory,
        handleSaveCategory,
        handleConfirmDelete
    } = useCategoryManagement(type);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">
                    {t("admin.categories.title")}
                </h2>
                <p className="text-muted-foreground">{t("admin.categories.subtitle")}</p>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <CardTitle className="flex items-center gap-2">
                            <Folder className="h-5 w-5" />
                            {t("admin.categories.all")} ({categories.length})
                        </CardTitle>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-1 sm:w-64">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="category-mgmt-search"
                                    name="search"
                                    placeholder={t("admin.categories.search")}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            <Button onClick={handleAddCategory}>
                                <Plus className="h-4 w-4 mr-2" />
                                {t("admin.categories.add")}
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-12">{t("admin.categories.loading")}</div>
                    ) : categories.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Folder className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>{t("admin.categories.noFound")}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{t("admin.categories.table.name")}</TableHead>
                                        <TableHead>{t("admin.categories.table.date")}</TableHead>
                                        <TableHead className="text-right">{t("admin.categories.table.actions")}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {categories.map((category) => (
                                        <TableRow key={category.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Folder className="h-4 w-4 text-muted-foreground" />
                                                    <span className="font-medium">
                                                        {getLocalizedContent(category, i18n.language)}
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
                            {selectedCategory ? t("admin.categories.dialog.edit") : t("admin.categories.dialog.add")}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="categoryName">
                                {t("admin.categories.dialog.nameLabel")} <span className="text-red-600">*</span>
                            </Label>
                            <Input
                                id="categoryName"
                                value={categoryName}
                                onChange={(e) => setCategoryName(e.target.value)}
                                placeholder={t("admin.categories.dialog.namePlaceholder")}
                                onKeyPress={(e) => {
                                    if (e.key === "Enter") {
                                        handleSaveCategory();
                                    }
                                }}
                            />
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
                            {selectedCategory ? t("admin.categories.dialog.update") : t("admin.categories.dialog.create")} {t("admin.categories.dialog.nameLabel")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <DeleteConfirmDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                title={t("admin.categories.delete.title")}
                description={t("admin.categories.delete.desc", { name: selectedCategory?.name })}
                onConfirm={handleConfirmDelete}
            />
        </div>
    );
};
