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
import { useTranslation } from "react-i18next";
import { stripHtml } from "@/core/utils/stringUtils";
import { FAQWithCategory } from "@/domains/content";

interface FAQTableProps {
  faqs: FAQWithCategory[];
  onEdit: (faq: FAQWithCategory) => void;
  onDelete: (faq: FAQWithCategory) => void;
  onToggleActive: (faq: FAQWithCategory) => void;
}

export const FAQTable = ({
  faqs,
  onEdit,
  onDelete,
  onToggleActive,
}: FAQTableProps) => {
  const { t } = useTranslation();

  return (
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
          {faqs.map((faq) => (
            <TableRow key={faq.id}>
              <TableCell className="max-w-md">
                <div className="space-y-1">
                  <p className="font-medium line-clamp-2">{faq.question}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">{stripHtml(faq.answer)}</p>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{t(`admin.faqs.categories.${faq.category.name.toLowerCase()}`, faq.category.name)}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={faq.is_active ? "default" : "secondary"}>
                  {faq.is_active ? t("admin.faqs.table.active") : t("admin.faqs.table.inactive")}
                </Badge>
              </TableCell>
              <TableCell>{new Date(faq.created_at).toLocaleDateString()}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="icon" onClick={() => onToggleActive(faq)}>
                    {faq.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onEdit(faq)}><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(faq)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
