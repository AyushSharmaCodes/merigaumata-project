import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Plus, Search, Download } from "lucide-react";
import { UserDialog } from "@/components/admin/UserDialog";
import { downloadCSV, flattenObject } from "@/lib/exportUtils";
import { toast } from "@/hooks/use-toast";
import { User } from "@/types";
import { useAuthStore } from "@/store/authStore";
import { userService } from "@/services/user.service";

export default function UsersManagement() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => {
      // Get current logged-in admin from Zustand store
      const currentUser = useAuthStore.getState().user;
      const currentAdminId = currentUser?.id;

      // Get all users and filter to show only admins created by current admin
      const allUsers = await userService.getAll();
      return allUsers.filter(
        (user) => user.role === "admin" && user.createdBy === currentAdminId
      );
    },
  });

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      user.phone?.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddNewAdmin = () => {
    setUserDialogOpen(true);
  };

  const handleExport = () => {
    if (filteredUsers.length === 0) {
      toast({
        title: t("common.noData"),
        description: t("admin.users.noDataDesc"),
        variant: "destructive",
      });
      return;
    }

    const exportData = filteredUsers.map((user) =>
      flattenObject({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        addressCount: user.addresses?.length || 0,
      })
    );

    downloadCSV(exportData, "admins");
    toast({
      title: t("common.exportSuccess"),
      description: t("admin.users.exportDesc"),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("admin.users.title")}</h1>
          <p className="text-muted-foreground">
            {t("admin.users.subtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            {t("common.exportCSV")}
          </Button>
          <Button onClick={handleAddNewAdmin}>
            <Plus className="h-4 w-4 mr-2" />
            {t("admin.users.addAdmin")}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="user-search"
            name="search"
            placeholder={t("admin.users.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("profile.personalInfo.name")}</TableHead>
              <TableHead>{t("profile.personalInfo.email")}</TableHead>
              <TableHead>{t("profile.personalInfo.phone")}</TableHead>
              <TableHead>{t("profile.address.title")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  {t("admin.users.loading")}
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-8 text-muted-foreground"
                >
                  {t("admin.users.noUsersFound")}
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => {
                const isDeleted = user.isDeleted ?? false;
                const isActive = user.isActive ?? true;

                // Determine status
                let statusText = t("admin.users.status.active");
                let statusClass = "bg-green-500";
                let statusVariant: "default" | "secondary" | "destructive" =
                  "default";

                if (isDeleted) {
                  statusText = t("admin.users.status.deleted");
                  statusClass = "bg-red-500";
                  statusVariant = "destructive";
                } else if (!isActive) {
                  statusText = t("admin.users.status.inactive");
                  statusClass = "bg-gray-400";
                  statusVariant = "secondary";
                }

                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.phone || "-"}</TableCell>
                    <TableCell>{t("admin.users.addresses", { count: user.addresses.length })}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant} className={statusClass}>
                        {statusText}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialogs */}
      <UserDialog open={userDialogOpen} onOpenChange={setUserDialogOpen} />
    </div>
  );
}
