import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { newsletterService, NewsletterSubscriber, NewsletterConfig } from "@/services/newsletter.service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Send, Plus, Pencil, Trash2, Users, UserCheck, UserX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { NewsletterSubscriberDialog } from "./NewsletterSubscriberDialog";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import { getErrorMessage } from "@/lib/errorUtils";
import { useTranslation } from "react-i18next";

export function NewsletterSection() {
  const { t, i18n } = useTranslation();
  const [subscriberDialogOpen, setSubscriberDialogOpen] = useState(false);
  const [editingSubscriber, setEditingSubscriber] = useState<NewsletterSubscriber | null>(null);
  const [deleteItem, setDeleteItem] = useState<{ id: string; email: string } | null>(null);
  const [configEdit, setConfigEdit] = useState(false);
  const [configData, setConfigData] = useState<NewsletterConfig | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch subscribers
  const { data: subscribers = [], isLoading: subscribersLoading } = useQuery({
    queryKey: ["newsletter-subscribers"],
    queryFn: () => newsletterService.getAllSubscribers(),
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ["newsletter-stats"],
    queryFn: () => newsletterService.getStats(),
  });

  // Fetch config
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["newsletter-config"],
    queryFn: () => newsletterService.getConfig(),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => newsletterService.deleteSubscriber(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["newsletter-subscribers"] });
      queryClient.invalidateQueries({ queryKey: ["newsletter-stats"] });
      toast({ title: t("admin.contact.newsletter.subscriberDeleted") });
      setDeleteItem(null);
    },
    onError: (error: unknown) => {
      toast({
        title: t("admin.contact.newsletter.deleteError"),
        description: getErrorMessage(error, t, "admin.contact.newsletter.deleteError"),
        variant: "destructive",
      });
    },
  });

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      newsletterService.updateSubscriber(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["newsletter-subscribers"] });
      queryClient.invalidateQueries({ queryKey: ["newsletter-stats"] });
      toast({ title: t("admin.contact.newsletter.statusUpdated") });
    },
    onError: (error: unknown) => {
      toast({
        title: t("admin.contact.newsletter.statusUpdateError"),
        description: getErrorMessage(error, t, "admin.contact.newsletter.statusUpdateError"),
        variant: "destructive",
      });
    },
  });

  // Update config mutation
  const updateConfigMutation = useMutation({
    mutationFn: (data: Partial<NewsletterConfig>) => newsletterService.updateConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["newsletter-config"] });
      toast({ title: t("admin.contact.newsletter.configUpdated") });
      setConfigEdit(false);
    },
    onError: (error: unknown) => {
      toast({
        title: t("admin.contact.newsletter.configUpdateError"),
        description: getErrorMessage(error, t, "admin.contact.newsletter.configUpdateError"),
        variant: "destructive",
      });
    },
  });

  const handleSaveConfig = () => {
    if (!configData?.sender_name || !configData?.sender_email) {
      toast({
        title: t("common.error"),
        description: t("admin.contact.newsletter.requiredFields"),
        variant: "destructive",
      });
      return;
    }
    updateConfigMutation.mutate(configData);
  };

  const handleEditConfig = () => {
    setConfigData(config || { sender_name: "", sender_email: "", footer_text: "" });
    setConfigEdit(true);
  };

  return (
    <>
      <NewsletterSubscriberDialog
        open={subscriberDialogOpen}
        onOpenChange={(open) => {
          setSubscriberDialogOpen(open);
          if (!open) setEditingSubscriber(null);
        }}
        subscriber={editingSubscriber}
      />

      <DeleteConfirmDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
        title={t("admin.contact.newsletter.deleteSubscriber")}
        description={t("admin.contact.newsletter.deleteConfirm", { email: deleteItem?.email })}
      />

      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("admin.contact.newsletter.total")}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("admin.contact.newsletter.active")}</CardTitle>
              <UserCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats?.active || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("admin.contact.newsletter.inactive")}</CardTitle>
              <UserX className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">{stats?.inactive || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  {t("admin.contact.newsletter.title")}
                </CardTitle>
                <CardDescription>{t("admin.contact.newsletter.subtitle")}</CardDescription>
              </div>
              {!configEdit && (
                <Button onClick={handleEditConfig} variant="outline" size="sm">
                  <Pencil className="h-4 w-4 mr-2" />
                  {t("common.edit")}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {configEdit && configData ? (
              <>
                <div className="space-y-2">
                  <Label>
                    {t("admin.contact.newsletter.senderName")} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={configData.sender_name}
                    onChange={(e) =>
                      setConfigData({ ...configData, sender_name: e.target.value })
                    }
                    placeholder={t("admin.contact.newsletter.senderNamePlaceholder")}
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    {t("admin.contact.newsletter.senderEmail")} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="email"
                    value={configData.sender_email}
                    onChange={(e) =>
                      setConfigData({ ...configData, sender_email: e.target.value })
                    }
                    placeholder={t("admin.contact.newsletter.senderEmailPlaceholder")}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("admin.contact.newsletter.footerText")}</Label>
                  <Textarea
                    value={configData.footer_text || ""}
                    onChange={(e) =>
                      setConfigData({ ...configData, footer_text: e.target.value })
                    }
                    rows={3}
                    maxLength={300}
                    placeholder={t("admin.contact.newsletter.footerPlaceholder")}
                  />
                  <div className="flex justify-end text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-1">
                    {(configData.footer_text || "").length}/300 {t("common.characters")}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleSaveConfig} disabled={updateConfigMutation.isPending}>
                    {t("admin.contact.newsletter.saveConfig")}
                  </Button>
                  <Button variant="outline" onClick={() => setConfigEdit(false)}>
                    {t("common.cancel")}
                  </Button>
                </div>
              </>
            ) : config ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">{t("admin.contact.newsletter.senderName")}</p>
                  <p className="font-medium">{config.sender_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("admin.contact.newsletter.senderEmail")}</p>
                  <p className="font-medium">{config.sender_email}</p>
                </div>
                {config.footer_text && (
                  <div>
                    <p className="text-sm text-muted-foreground">{t("admin.contact.newsletter.footerText")}</p>
                    <p className="text-sm">{config.footer_text}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("admin.contact.loading.newsletterConfig")}</p>
            )}
          </CardContent>
        </Card>

        {/* Subscribers List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t("admin.contact.newsletter.subscribersTitle")}</CardTitle>
                <CardDescription>{t("admin.contact.newsletter.subscribersSubtitle")}</CardDescription>
              </div>
              <Button
                onClick={() => {
                  setEditingSubscriber(null);
                  setSubscriberDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                {t("admin.contact.newsletter.addSubscriber")}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {subscribersLoading ? (
              <p className="text-center text-muted-foreground py-8">{t("admin.contact.newsletter.loading")}</p>
            ) : subscribers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {t("admin.contact.newsletter.empty")}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.contact.newsletter.table.email")}</TableHead>
                    <TableHead>{t("admin.contact.newsletter.table.name")}</TableHead>
                    <TableHead>{t("admin.contact.newsletter.table.status")}</TableHead>
                    <TableHead>{t("admin.contact.newsletter.table.date")}</TableHead>
                    <TableHead className="text-right">{t("common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscribers.map((subscriber) => (
                    <TableRow key={subscriber.id}>
                      <TableCell className="font-medium">{subscriber.email}</TableCell>
                      <TableCell>{subscriber.name || t("common.na")}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={subscriber.is_active}
                            onCheckedChange={(checked) =>
                              toggleStatusMutation.mutate({
                                id: subscriber.id,
                                is_active: checked,
                              })
                            }
                          />
                          <Badge variant={subscriber.is_active ? "default" : "secondary"}>
                            {subscriber.is_active ? t("admin.contact.newsletter.activeStatus") : t("admin.contact.newsletter.inactiveStatus")}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(subscriber.subscribed_at).toLocaleDateString(i18n.language)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingSubscriber(subscriber);
                              setSubscriberDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDeleteItem({ id: subscriber.id, email: subscriber.email })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
