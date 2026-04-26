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
import { TeamMember } from "@/shared/types";

interface TeamTabProps {
  members: TeamMember[];
  onAdd: () => void;
  onEdit: (member: TeamMember) => void;
  onDelete: (member: TeamMember) => void;
}

export const TeamTab = ({ members, onAdd, onEdit, onDelete }: TeamTabProps) => {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t("admin.about.team.title")}</CardTitle>
          <Button size="sm" onClick={onAdd}>
            <Plus className="mr-2 h-4 w-4" />
            {t("admin.about.team.add")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.about.team.table.image")}</TableHead>
              <TableHead>{t("admin.about.team.table.name")}</TableHead>
              <TableHead>{t("admin.about.team.table.role")}</TableHead>
              <TableHead>{t("admin.about.team.table.bio")}</TableHead>
              <TableHead>{t("admin.about.team.table.order")}</TableHead>
              <TableHead className="text-right">{t("admin.about.team.table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members
              .sort((a, b) => a.order - b.order)
              .map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <img src={member.image} alt={member.name} className="w-10 h-10 rounded-full object-cover border-2 border-border" />
                  </TableCell>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell>{member.role}</TableCell>
                  <TableCell className="max-w-md truncate">{member.bio}</TableCell>
                  <TableCell>{member.order}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => onEdit(member)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onDelete(member)}>
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
