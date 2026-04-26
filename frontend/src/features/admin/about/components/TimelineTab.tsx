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
import { TimelineItem } from "@/shared/types";

interface TimelineTabProps {
  timeline: TimelineItem[];
  onAdd: () => void;
  onEdit: (item: TimelineItem) => void;
  onDelete: (item: TimelineItem) => void;
}

export const TimelineTab = ({ timeline, onAdd, onEdit, onDelete }: TimelineTabProps) => {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t("admin.about.timeline.title")}</CardTitle>
          <Button size="sm" onClick={onAdd}>
            <Plus className="mr-2 h-4 w-4" />
            {t("admin.about.timeline.add")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.about.timeline.table.date")}</TableHead>
              <TableHead>{t("admin.about.timeline.table.title")}</TableHead>
              <TableHead>{t("admin.about.timeline.table.desc")}</TableHead>
              <TableHead>{t("admin.about.timeline.table.order")}</TableHead>
              <TableHead className="text-right">{t("admin.about.timeline.table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {timeline
              .sort((a, b) => a.order - b.order)
              .map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.month} {item.year}</TableCell>
                  <TableCell>{item.title}</TableCell>
                  <TableCell className="max-w-md truncate">{item.description}</TableCell>
                  <TableCell>{item.order}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => onEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onDelete(item)}>
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
