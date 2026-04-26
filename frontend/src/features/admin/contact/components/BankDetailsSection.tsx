import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Plus, Trash2, Save, X, Building2 } from "lucide-react";
import { bankDetailsService, type BankDetails } from "@/domains/donation";
import { useToast } from "@/shared/hooks/use-toast";
import { getErrorMessage } from "@/core/utils/errorUtils";
import { useTranslation } from "react-i18next";
import { DeleteConfirmDialog } from "@/features/admin";

interface BankDetailsSectionProps {
  bankDetails: BankDetails[];
  onRefresh: () => void;
}

export function BankDetailsSection({
  bankDetails,
  onRefresh,
}: BankDetailsSectionProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<BankDetails>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [newDetails, setNewDetails] = useState<Partial<BankDetails>>({
    type: "general",
  });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  });
  const queryClient = useQueryClient();

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: Partial<BankDetails>) => bankDetailsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-details"] });
      toast({
        title: t("common.success"),
        description: t("admin.bank.added"),
      });
      setNewDetails({ type: "general" });
      setIsAdding(false);
    },
    onError: (error: unknown) => {
      toast({
        title: t("common.error"),
        description: getErrorMessage(error, t, "admin.bank.addError"),
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BankDetails> }) =>
      bankDetailsService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-details"] });
      toast({
        title: t("common.success"),
        description: t("admin.bank.updated"),
      });
      setEditingId(null);
      setEditData({});
    },
    onError: (error: unknown) => {
      toast({
        title: t("common.error"),
        description: getErrorMessage(error, t, "admin.bank.updateError"),
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => bankDetailsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-details"] });
      toast({
        title: t("common.success"),
        description: t("admin.bank.deleted"),
      });
    },
    onError: (error: unknown) => {
      toast({
        title: t("common.error"),
        description: getErrorMessage(error, t, "admin.bank.deleteError"),
        variant: "destructive",
      });
    },
  });

  const handleAdd = () => {
    // Trim whitespace from all string fields
    const trimmedDetails = {
      ...newDetails,
      account_name: newDetails.account_name?.trim(),
      account_number: newDetails.account_number?.trim(),
      ifsc_code: newDetails.ifsc_code?.trim(),
      bank_name: newDetails.bank_name?.trim(),
      branch_name: newDetails.branch_name?.trim(),
      upi_id: newDetails.upi_id?.trim(),
    };

    // Validate required fields with specific messages
    if (!trimmedDetails.account_name) {
      toast({
        title: t("common.error"),
        description: t("admin.bank.nameRequired"),
        variant: "destructive",
      });
      return;
    }
    if (!trimmedDetails.account_number) {
      toast({
        title: t("common.error"),
        description: t("admin.bank.numberRequired"),
        variant: "destructive",
      });
      return;
    }
    if (!trimmedDetails.ifsc_code) {
      toast({
        title: t("common.error"),
        description: t("admin.bank.ifscRequired"),
        variant: "destructive",
      });
      return;
    }
    if (!trimmedDetails.bank_name) {
      toast({
        title: t("common.error"),
        description: t("admin.bank.bankNameRequired"),
        variant: "destructive",
      });
      return;
    }
    if (!trimmedDetails.type) {
      toast({
        title: t("common.error"),
        description: t("admin.bank.typeRequired"),
        variant: "destructive",
      });
      return;
    }

    // Check if account type already exists
    const typeExists = bankDetails.some(
      (b) => b.type === trimmedDetails.type && b.is_active
    );

    if (typeExists) {
      toast({
        title: t("common.error"),
        description: t("admin.bank.alreadyExists", { type: t(`admin.bank.${trimmedDetails.type}`) }),
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate(trimmedDetails);
  };

  const handleUpdate = (id: string) => {
    if (
      !editData.account_name ||
      !editData.account_number ||
      !editData.ifsc_code ||
      !editData.bank_name
    ) {
      toast({
        title: t("common.error"),
        description: t("admin.bank.allFieldsRequired"),
        variant: "destructive",
      });
      return;
    }

    updateMutation.mutate({ id, data: editData });
  };

  const handleDelete = (id: string) => {
    setDeleteDialog({ open: true, id });
  };

  const confirmDelete = () => {
    if (deleteDialog.id) {
      deleteMutation.mutate(deleteDialog.id);
      setDeleteDialog({ open: false, id: null });
    }
  };

  const startEdit = (detail: BankDetails) => {
    setEditingId(detail.id);
    setEditData(detail);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {t("admin.bank.title")}
          </CardTitle>
          <Button type="button" onClick={() => setIsAdding(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            {t("admin.bank.add")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdding && (
          <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
            <h4 className="font-semibold">{t("admin.bank.addNew")}</h4>

            <div className="space-y-2">
              <Label>
                {t("admin.bank.accountType")} <span className="text-destructive">*</span>
              </Label>
              <Select
                value={newDetails.type}
                onValueChange={(value) =>
                  setNewDetails({
                    ...newDetails,
                    type: value as "general" | "donation",
                  })
                }
              >
                <SelectTrigger aria-label={t("admin.bank.accountType")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    value="general"
                    disabled={bankDetails.some(b => b.type === 'general' && b.is_active)}
                  >
                    {t("admin.bank.general")} {bankDetails.some(b => b.type === 'general' && b.is_active) && `✓ ${t("admin.bank.alreadyExistsSymbol")}`}
                  </SelectItem>
                  <SelectItem
                    value="donation"
                    disabled={bankDetails.some(b => b.type === 'donation' && b.is_active)}
                  >
                    {t("admin.bank.donation")} {bankDetails.some(b => b.type === 'donation' && b.is_active) && `✓ ${t("admin.bank.alreadyExistsSymbol")}`}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {newDetails.type === "donation"
                  ? t("admin.bank.typeNoteDonation")
                  : t("admin.bank.typeNoteGeneral")}
              </p>
              {bankDetails.some(b => b.type === newDetails.type && b.is_active) && (
                <p className="text-xs text-destructive">
                  ⚠️ {t("admin.bank.alreadyExists", { type: t(`admin.bank.${newDetails.type}`) })}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  {t("admin.bank.accountName")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={newDetails.account_name || ""}
                  onChange={(e) =>
                    setNewDetails({
                      ...newDetails,
                      account_name: e.target.value,
                    })
                  }
                  placeholder={t("admin.bank.accountNamePlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  {t("admin.bank.accountNumber")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={newDetails.account_number || ""}
                  onChange={(e) =>
                    setNewDetails({
                      ...newDetails,
                      account_number: e.target.value,
                    })
                  }
                  placeholder={t("admin.bank.accountNumberPlaceholder")}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  {t("admin.bank.ifscCode")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={newDetails.ifsc_code || ""}
                  onChange={(e) =>
                    setNewDetails({ ...newDetails, ifsc_code: e.target.value })
                  }
                  placeholder={t("admin.bank.ifscPlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  {t("admin.bank.bankName")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={newDetails.bank_name || ""}
                  onChange={(e) =>
                    setNewDetails({ ...newDetails, bank_name: e.target.value })
                  }
                  placeholder={t("admin.bank.bankNamePlaceholder")}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("admin.bank.branchName")}</Label>
                <Input
                  value={newDetails.branch_name || ""}
                  onChange={(e) =>
                    setNewDetails({ ...newDetails, branch_name: e.target.value })
                  }
                  placeholder={t("admin.bank.branchPlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("admin.bank.upiId")}</Label>
                <Input
                  value={newDetails.upi_id || ""}
                  onChange={(e) =>
                    setNewDetails({ ...newDetails, upi_id: e.target.value })
                  }
                  placeholder={t("admin.bank.upiPlaceholder")}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="button" onClick={handleAdd} size="sm" disabled={createMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                {createMutation.isPending ? t("admin.bank.saving") : t("admin.bank.save")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAdding(false);
                  setNewDetails({ type: "general" });
                }}
                size="sm"
              >
                <X className="h-4 w-4 mr-2" />
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        )}

        {bankDetails.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {t("admin.bank.empty")}
          </p>
        ) : (
          <div className="space-y-4">
            {bankDetails.map((detail) => (
              <div
                key={detail.id}
                className="border rounded-lg p-4 space-y-4 bg-card"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-8 w-8 text-primary" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{detail.account_name}</p>
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${detail.type === "donation"
                            ? "bg-green-100 text-green-700"
                            : "bg-blue-100 text-blue-700"
                            }`}
                        >
                          {detail.type === "donation" ? t("admin.bank.donation") : t("admin.bank.general")}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {detail.bank_name}
                        {detail.branch_name && ` - ${detail.branch_name}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {editingId !== detail.id && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(detail)}
                        >
                          {t("common.edit")}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(detail.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {editingId === detail.id ? (
                  <div className="space-y-4 pt-2 border-t">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t("admin.bank.accountName")}</Label>
                        <Input
                          value={editData.account_name || ""}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              account_name: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("admin.bank.accountNumber")}</Label>
                        <Input
                          value={editData.account_number || ""}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              account_number: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("admin.bank.ifscCode")}</Label>
                        <Input
                          value={editData.ifsc_code || ""}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              ifsc_code: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("admin.bank.bankName")}</Label>
                        <Input
                          value={editData.bank_name || ""}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              bank_name: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("admin.bank.branchName")}</Label>
                        <Input
                          value={editData.branch_name || ""}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              branch_name: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("admin.bank.upiId")}</Label>
                        <Input
                          value={editData.upi_id || ""}
                          onChange={(e) =>
                            setEditData({ ...editData, upi_id: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button type="button" onClick={() => handleUpdate(detail.id)} size="sm" disabled={updateMutation.isPending}>
                        <Save className="h-4 w-4 mr-2" />
                        {updateMutation.isPending ? t("admin.bank.saving") : t("admin.bank.update")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditingId(null);
                          setEditData({});
                        }}
                        size="sm"
                      >
                        {t("common.cancel")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">{t("admin.bank.accountNumber")}</p>
                      <p className="font-mono">{detail.account_number}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t("admin.bank.ifscCode")}</p>
                      <p className="font-mono">{detail.ifsc_code}</p>
                    </div>
                    {detail.upi_id && (
                      <div>
                        <p className="text-muted-foreground">{t("admin.bank.upiId")}</p>
                        <p className="font-mono">{detail.upi_id}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <DeleteConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}
        title={t("admin.bank.title")}
        description={t("admin.bank.deleteConfirm")}
        onConfirm={confirmDelete}
        isLoading={deleteMutation.isPending}
      />
    </Card>
  );
}
