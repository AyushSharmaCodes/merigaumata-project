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
import { ImpactStat } from "@/shared/types";

interface ImpactStatsTabProps {
  stats: ImpactStat[];
  onAdd: () => void;
  onEdit: (stat: ImpactStat) => void;
  onDelete: (stat: ImpactStat) => void;
}

export const ImpactStatsTab = ({ stats, onAdd, onEdit, onDelete }: ImpactStatsTabProps) => {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t("admin.about.impact.title")}</CardTitle>
          <Button size="sm" onClick={onAdd}>
            <Plus className="mr-2 h-4 w-4" />
            {t("admin.about.impact.add")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.about.impact.table.value")}</TableHead>
              <TableHead>{t("admin.about.impact.table.label")}</TableHead>
              <TableHead>{t("admin.about.impact.table.icon")}</TableHead>
              <TableHead>{t("admin.about.impact.table.order")}</TableHead>
              <TableHead className="text-right">{t("admin.about.impact.table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats
              .sort((a, b) => a.order - b.order)
              .map((stat) => (
                <TableRow key={stat.id}>
                  <TableCell className="font-medium">{stat.value}</TableCell>
                  <TableCell>{stat.label}</TableCell>
                  <TableCell>{stat.icon}</TableCell>
                  <TableCell>{stat.order}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => onEdit(stat)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onDelete(stat)}>
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
