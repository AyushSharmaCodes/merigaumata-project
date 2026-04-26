import { useFAQsManagement, FAQTable } from "@/features/admin/static";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Plus, Search, HelpCircle, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { FAQDialog } from "@/features/admin";
import { DeleteConfirmDialog } from "@/features/admin";

export default function FAQsManagement() {
  const {
    t,
    searchQuery, setSearchQuery,
    categoryFilter, setCategoryFilter,
    faqDialogOpen, setFaqDialogOpen,
    deleteDialogOpen, setDeleteDialogOpen,
    selectedFaq, setSelectedFaq,
    currentPage, setCurrentPage,
    categories,
    filteredFaqs,
    paginatedFaqs,
    totalPages,
    startIndex,
    isLoading,
    faqMutation,
    deleteMutation,
    toggleActiveMutation,
    handleExport,
  } = useFAQsManagement();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("admin.faqs.title")}</h1>
          <p className="text-muted-foreground">{t("admin.faqs.subtitle")}</p>
        </div>
        <Button onClick={() => { setSelectedFaq(null); setFaqDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          {t("admin.faqs.add")}
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><HelpCircle className="h-5 w-5" />{t("admin.faqs.listTitle")}</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="faq-search"
                  placeholder={t("admin.faqs.search")}
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="pl-9"
                />
              </div>
              <Select value={categoryFilter} onValueChange={(val) => { setCategoryFilter(val); setCurrentPage(1); }}>
                <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder={t("admin.faqs.allCategories")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.faqs.allCategories")}</SelectItem>
                  {categories.map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4" />{t("admin.faqs.export")}</Button>
            </div>

            {isLoading ? <div className="text-center py-8 text-muted-foreground">{t("admin.dashboard.loading")}</div> :
             filteredFaqs.length === 0 ? <div className="text-center py-8 text-muted-foreground">{t("admin.faqs.empty")}</div> :
             <FAQTable
               faqs={paginatedFaqs}
               onEdit={(faq) => { setSelectedFaq(faq); setFaqDialogOpen(true); }}
               onDelete={(faq) => { setSelectedFaq(faq); setDeleteDialogOpen(true); }}
               onToggleActive={(faq) => toggleActiveMutation.mutate(faq.id)}
             />
            }

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                <p>{t("admin.faqs.pagination.showing", { start: filteredFaqs.length > 0 ? startIndex + 1 : 0, end: Math.min(startIndex + 10, filteredFaqs.length), total: filteredFaqs.length })}</p>
                <p className="mt-1">{t("admin.faqs.stats.summary", { active: filteredFaqs.filter((f) => f.is_active).length, inactive: filteredFaqs.filter((f) => !f.is_active).length, total: filteredFaqs.length })}</p>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" />{t("admin.faqs.pagination.previous")}</Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <Button key={p} variant={currentPage === p ? "default" : "outline"} size="sm" onClick={() => setCurrentPage(p)} className="w-9">{p}</Button>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>{t("admin.faqs.pagination.next")}<ChevronRight className="h-4 w-4" /></Button>
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
