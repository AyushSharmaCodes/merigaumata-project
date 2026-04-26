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
import { FutureGoal } from "@/shared/types";

interface GoalsTabProps {
  goals: FutureGoal[];
  onAdd: () => void;
  onEdit: (goal: FutureGoal) => void;
  onDelete: (goal: FutureGoal) => void;
}

export const GoalsTab = ({ goals, onAdd, onEdit, onDelete }: GoalsTabProps) => {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t("admin.about.goals.title")}</CardTitle>
          <Button size="sm" onClick={onAdd}>
            <Plus className="mr-2 h-4 w-4" />
            {t("admin.about.goals.add")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.about.goals.table.title")}</TableHead>
              <TableHead>{t("admin.about.goals.table.desc")}</TableHead>
              <TableHead>{t("admin.about.goals.table.order")}</TableHead>
              <TableHead className="text-right">{t("admin.about.goals.table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {goals
              .sort((a, b) => a.order - b.order)
              .map((goal) => (
                <TableRow key={goal.id}>
                  <TableCell className="font-medium">{goal.title}</TableCell>
                  <TableCell className="max-w-md truncate">{goal.description}</TableCell>
                  <TableCell>{goal.order}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => onEdit(goal)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onDelete(goal)}>
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
