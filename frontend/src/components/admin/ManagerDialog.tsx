import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { managerService, Manager, CreateManagerData } from "@/services/manager.service";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/store/authStore";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { getErrorMessage } from "@/lib/errorUtils";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ManagerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    manager?: Manager | null;
}

export function ManagerDialog({ open, onOpenChange, manager }: ManagerDialogProps) {
    const { t } = useTranslation();
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [permissions, setPermissions] = useState<Record<string, boolean>>({});
    const [selectAll, setSelectAll] = useState(false);

    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { user } = useAuthStore();

    const PERMISSION_LABELS: Record<string, string> = {
        can_manage_products: t("admin.managers.permissions.canManageProducts"),
        can_manage_categories: t("admin.managers.permissions.canManageCategories"),
        can_manage_orders: t("admin.managers.permissions.canManageOrders"),
        can_manage_events: t("admin.managers.permissions.canManageEvents"),
        can_manage_blogs: t("admin.managers.permissions.canManageBlogs"),
        can_manage_testimonials: t("admin.managers.permissions.canManageTestimonials"),
        can_manage_gallery: t("admin.managers.permissions.canManageGallery"),
        can_manage_faqs: t("admin.managers.permissions.canManageFaqs"),
        can_manage_carousel: t("admin.managers.permissions.canManageCarousel"),
        can_manage_contact_info: t("admin.managers.permissions.canManageContactInfo"),
        can_manage_social_media: t("admin.managers.permissions.canManageSocialMedia"),
        can_manage_bank_details: t("admin.managers.permissions.canManageBankDetails"),
        can_manage_about_us: t("admin.managers.permissions.canManageAboutUs"),
        can_manage_newsletter: t("admin.managers.permissions.canManageNewsletter"),
        can_manage_reviews: t("admin.managers.permissions.canManageReviews"),
        can_manage_policies: t("admin.managers.permissions.canManagePolicies"),
        can_manage_contact_messages: t("admin.managers.permissions.canManageContactMessages"),
        can_manage_coupons: t("admin.managers.permissions.canManageCoupons"),
    };

    useEffect(() => {
        if (open) {
            if (manager) {
                setEmail(manager.email);
                setName(manager.name);

                const permissionsData = Array.isArray(manager.manager_permissions)
                    ? manager.manager_permissions[0]
                    : manager.manager_permissions;

                if (permissionsData) {
                    const newPerms: Record<string, boolean> = {};
                    Object.entries(permissionsData).forEach(([key, value]) => {
                        if (key.startsWith("can_manage_") && typeof value === "boolean") {
                            newPerms[key] = value;
                        }
                    });
                    setPermissions(newPerms);
                    setSelectAll(Object.values(newPerms).every((v) => v));
                } else {
                    setPermissions({});
                    setSelectAll(false);
                }
            } else {
                setEmail("");
                setName("");
                setPermissions({});
                setSelectAll(false);
            }
        }
    }, [manager, open]);

    const createMutation = useMutation({
        mutationFn: (data: CreateManagerData) => managerService.create({
            ...data,
            created_by: user?.id
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["managers"] });
            toast({ title: t("admin.managers.dialog.toasts.createSuccess") });
            onOpenChange(false);
        },
        onError: (error: unknown) => {
            toast({
                title: t("admin.managers.dialog.toasts.createError"),
                description: getErrorMessage(error, t("admin.managers.dialog.toasts.createError")),
                variant: "destructive",
            });
        },
    });

    const updateMutation = useMutation({
        mutationFn: (data: { id: string; permissions: Record<string, boolean> }) =>
            managerService.updatePermissions(data.id, data.permissions),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["managers"] });
            toast({ title: t("admin.managers.dialog.toasts.updateSuccess") });
            onOpenChange(false);
        },
        onError: (error: unknown) => {
            toast({
                title: t("admin.managers.dialog.toasts.updateError"),
                description: getErrorMessage(error, t("admin.managers.dialog.toasts.updateError")),
                variant: "destructive",
            });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!email.trim() || !name.trim()) {
            toast({
                title: t("common.error"),
                description: t("auth.fillAllFields"),
                variant: "destructive",
            });
            return;
        }

        if (manager) {
            updateMutation.mutate({
                id: manager.id,
                permissions,
            });
        } else {
            createMutation.mutate({
                email: email.trim(),
                name: name.trim(),
                permissions,
            });
        }
    };

    const handleSelectAll = (checked: boolean) => {
        setSelectAll(checked);
        const newPerms: Record<string, boolean> = {};
        Object.keys(PERMISSION_LABELS).forEach((key) => {
            newPerms[key] = checked;
        });
        setPermissions(newPerms);
    };

    const handlePermissionChange = (key: string, checked: boolean) => {
        const newPerms = { ...permissions, [key]: checked };
        setPermissions(newPerms);
        setSelectAll(Object.keys(PERMISSION_LABELS).every(k => newPerms[k]));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
                <LoadingOverlay isLoading={createMutation.isPending || updateMutation.isPending} />
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle>{manager ? t("admin.managers.dialog.editTitle") : t("admin.managers.dialog.createTitle")}</DialogTitle>
                    <DialogDescription>
                        {manager
                            ? t("admin.managers.dialog.editDesc")
                            : t("admin.managers.dialog.createDesc")}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <ScrollArea className="flex-1 p-1">
                        <div className="space-y-4 py-2 px-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-sm">
                                        {t("profile.personalInfo.email")} <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder={t("admin.managers.dialog.emailPlaceholder")}
                                        disabled={!!manager}
                                        required
                                        autoComplete="off"
                                        className="h-9 w-full border border-input disabled:opacity-100 disabled:bg-muted/50"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="name" className="text-sm">
                                        {t("profile.personalInfo.name")} <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="name"
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder={t("admin.managers.dialog.namePlaceholder")}
                                        disabled={!!manager}
                                        required
                                        autoComplete="off"
                                        className="h-9 w-full border border-input disabled:opacity-100 disabled:bg-muted/50"
                                    />
                                </div>

                                <p className="text-xs text-muted-foreground md:col-span-2">
                                    {t("admin.managers.dialog.tempPasswordNote")}
                                </p>
                            </div>

                            <div className="space-y-3 pt-2 border-t">
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm font-semibold">{t("admin.managers.permissions.modulePermissions")}</Label>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="select-all"
                                            checked={selectAll}
                                            onCheckedChange={handleSelectAll}
                                        />
                                        <label
                                            htmlFor="select-all"
                                            className="text-xs font-medium leading-none cursor-pointer"
                                        >
                                            {t("admin.managers.permissions.selectAll")}
                                        </label>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2.5">
                                    {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                                        <div key={key} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={key}
                                                checked={permissions[key] || false}
                                                onCheckedChange={(checked) =>
                                                    handlePermissionChange(key, checked as boolean)
                                                }
                                            />
                                            <label
                                                htmlFor={key}
                                                className="text-xs font-medium leading-none cursor-pointer"
                                            >
                                                {label}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </ScrollArea>

                    <DialogFooter className="flex-shrink-0 mt-4 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            {t("common.cancel")}
                        </Button>
                        <Button
                            type="submit"
                            disabled={createMutation.isPending || updateMutation.isPending}
                        >
                            {manager ? t("common.update") : t("common.create")}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog >
    );
}
