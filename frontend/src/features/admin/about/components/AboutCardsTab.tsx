import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { useTranslation } from "react-i18next";
import { AboutCard } from "@/shared/types";

interface AboutCardsTabProps {
  cards: AboutCard[];
  onAdd: () => void;
  onEdit: (card: AboutCard) => void;
  onDelete: (card: AboutCard) => void;
}

export const AboutCardsTab = ({ cards, onAdd, onEdit, onDelete }: AboutCardsTabProps) => {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t("admin.about.cards.title")}</CardTitle>
          <Button size="sm" onClick={onAdd}>
            <Plus className="mr-2 h-4 w-4" />
            {t("admin.about.cards.add")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.about.cards.table.title")}</TableHead>
              <TableHead>{t("admin.about.cards.table.desc")}</TableHead>
              <TableHead>{t("admin.about.cards.table.icon")}</TableHead>
              <TableHead>{t("admin.about.cards.table.order")}</TableHead>
              <TableHead className="text-right">{t("admin.categories.table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cards
              .sort((a, b) => a.order - b.order)
              .map((card) => (
                <TableRow key={card.id}>
                  <TableCell className="font-medium">{card.title}</TableCell>
                  <TableCell className="max-w-md truncate">{card.description}</TableCell>
                  <TableCell>{card.icon}</TableCell>
                  <TableCell>{card.order}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => onEdit(card)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onDelete(card)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
