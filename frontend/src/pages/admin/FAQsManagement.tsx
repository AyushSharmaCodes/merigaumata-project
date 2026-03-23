import { logger } from "@/lib/logger";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  HelpCircle,
  Download,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { FAQDialog } from "@/components/admin/FAQDialog";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { downloadCSV, flattenObject } from "@/lib/exportUtils";
import { faqService, type FAQWithCategory } from "@/services/faq.service";
import { categoryService, type Category } from "@/services/category.service";
import { I18nInput } from "@/components/admin/I18nInput";

const ITEMS_PER_PAGE = 10;

export default function FAQsManagement() {
  const { i18n, t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [faqDialogOpen, setFaqDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedFaq, setSelectedFaq] = useState<FAQWithCategory | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const queryClient = useQueryClient();

  const { data: faqs = [], isLoading } = useQuery({
    queryKey: ["admin-faqs", i18n.language],
    queryFn: async () => {
      try {
        const data = await faqService.getAll(true);
        logger.debug('Admin FAQs loaded:', { count: data?.length || 0 });
        return data;
      } catch (error) {
        logger.error('Error loading admin FAQs:', error);
        toast({
          title: t("admin.faqs.messages.errorLoad"),
          description: getErrorMessage(error, t, "admin.faqs.messages.errorLoadDetail"),
          variant: "destructive",
        });
        throw error;
      }
    },
  });

  // Client-side filtering
  const filteredFaqs = faqs.filter((faq) => {
    const matchesCategory = categoryFilter === "all" || faq.category_id === categoryFilter;
    const matchesSearch = !searchQuery ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Calculate pagination
  const totalPages = Math.ceil((filteredFaqs?.length || 0) / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedFaqs = filteredFaqs.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleCategoryChange = (value: string) => {
    setCategoryFilter(value);
    setCurrentPage(1);
  };

  const { data: categories = [] } = useQuery({
    queryKey: ["faq-categories", i18n.language],
    queryFn: async () => {
      return await categoryService.getAll('faq');
    },
  });

  const faqMutation = useMutation({
    mutationFn: async (faq: {
      id?: string;
      question: string;
      question_i18n: Record<string, string>;
      answer: string;
      answer_i18n: Record<string, string>;
      category_id: string;
      display_order?: number;
      is_active?: boolean;
    }) => {
      if (faq.id) {
        return await faqService.update(faq.id, {
          question: faq.question,
          question_i18n: faq.question_i18n,
          answer: faq.answer,
          answer_i18n: faq.answer_i18n,
          category_id: faq.category_id,
          display_order: faq.display_order,
          is_active: faq.is_active,
        });
      } else {
        return await faqService.create({
          question: faq.question,
          question_i18n: faq.question_i18n,
          answer: faq.answer,
          answer_i18n: faq.answer_i18n,
          category_id: faq.category_id,
          display_order: faq.display_order,
          is_active: faq.is_active,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-faqs"] });
      toast({
        title: "Success",
        description: selectedFaq
          ? "FAQ updated successfully"
          : "FAQ created successfully",
      });
      setFaqDialogOpen(false);
      setSelectedFaq(null);
    },
    onError: (error: unknown) => {
      toast({
        title: t("common.error"),
        description: getErrorMessage(error, t, "admin.faqs.messages.errorSave"),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await faqService.delete(id);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-faqs"] });
      toast({
        title: t("common.success"),
        description: t("admin.faqs.toasts.deleteSuccess"),
      });
      setDeleteDialogOpen(false);
      setSelectedFaq(null);
    },
    onError: (error: unknown) => {
      toast({
        title: t("common.error"),
        description: getErrorMessage(error, t, "admin.faqs.messages.errorDelete"),
        variant: "destructive",
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (id: string) => {
      return await faqService.toggleActive(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-faqs"] });
      toast({
        title: t("common.success"),
        description: t("admin.faqs.messages.statusUpdated"),
      });
    },
    onError: (error: unknown) => {
      toast({
        title: t("common.error"),
        description: getErrorMessage(error, t, "admin.faqs.messages.errorStatusUpdate"),
        variant: "destructive",
      });
    },
  });

  const handleAddFaq = () => {
    setSelectedFaq(null);
    setFaqDialogOpen(true);
  };

  const handleEditFaq = (faq: FAQWithCategory) => {
    setSelectedFaq(faq);
    setFaqDialogOpen(true);
  };

  const handleDelete = (faq: FAQWithCategory) => {
    setSelectedFaq(faq);
    setDeleteDialogOpen(true);
  };

  const handleToggleActive = (faq: FAQWithCategory) => {
    toggleActiveMutation.mutate(faq.id);
  };

  const handleExport = () => {
    const exportData = faqs.map((faq) => flattenObject(faq as unknown as Record<string, unknown>));
    downloadCSV(exportData, "faqs");
    toast({
      title: t("common.success"),
      description: t("admin.faqs.messages.exported"),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("admin.faqs.title")}</h1>
          <p className="text-muted-foreground">
            {t("admin.faqs.subtitle")}
          </p>
        </div>
        <Button onClick={handleAddFaq}>
          <Plus className="mr-2 h-4 w-4" />
          {t("admin.faqs.add")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            {t("admin.faqs.listTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="faq-search"
                  name="search"
                  placeholder={t("admin.faqs.search")}
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={categoryFilter}
                onValueChange={handleCategoryChange}
              >
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder={t("admin.faqs.allCategories")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.faqs.allCategories")}</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                {t("admin.orders.export.button")}
              </Button>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                {t("admin.dashboard.loading")}
              </div>
            ) : faqs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t("admin.orders.empty")}
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.faqs.table.question")}</TableHead>
                      <TableHead>{t("admin.faqs.table.category")}</TableHead>
                      <TableHead>{t("admin.faqs.table.status")}</TableHead>
                      <TableHead>{t("admin.faqs.table.created")}</TableHead>
                      <TableHead className="text-right">{t("admin.faqs.table.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedFaqs.map((faq) => (
                      <TableRow key={faq.id}>
                        <TableCell className="max-w-md">
                          <div className="space-y-1">
                            <p className="font-medium line-clamp-2">
                              {faq.question}
                            </p>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {faq.answer}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{t(`admin.faqs.categories.${faq.category.name.toLowerCase()}`, faq.category.name)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={faq.is_active ? "default" : "secondary"}
                          >
                            {faq.is_active ? t("admin.faqs.table.active") : t("admin.faqs.table.inactive")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(faq.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleActive(faq)}
                            >
                              {faq.is_active ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditFaq(faq)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(faq)}
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

            {/* Pagination & Stats */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                <p>
                  {t("admin.faqs.pagination.showing", {
                    start: filteredFaqs.length > 0 ? startIndex + 1 : 0,
                    end: Math.min(endIndex, filteredFaqs.length),
                    total: filteredFaqs.length
                  })}
                </p>
                <p className="mt-1">
                  {t("admin.faqs.stats.summary", {
                    active: filteredFaqs.filter((f) => f.is_active).length,
                    inactive: filteredFaqs.filter((f) => !f.is_active).length,
                    total: filteredFaqs.length
                  })}
                </p>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {t("admin.faqs.pagination.previous")}
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (page) => (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className="w-9"
                        >
                          {page}
                        </Button>
                      )
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    {t("admin.faqs.pagination.next")}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <FAQDialog
        open={faqDialogOpen}
        onOpenChange={setFaqDialogOpen}
        onSave={(faq) => faqMutation.mutate(faq)}
        faq={selectedFaq}
        categories={categories}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => selectedFaq && deleteMutation.mutate(selectedFaq.id)}
        title={t("admin.faqs.delete.title")}
        description={t("admin.faqs.delete.description")}
      />
    </div>
  );
}
