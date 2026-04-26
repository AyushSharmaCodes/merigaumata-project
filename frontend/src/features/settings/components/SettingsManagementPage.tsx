import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Coins, Truck, Hammer, ShieldCheck } from 'lucide-react';
import { Skeleton } from '@/shared/components/ui/page-skeletons';
import { Switch } from '@/shared/components/ui/switch';
import CouponsManagement from '@/pages/admin/CouponsManagement';
import { useSettings } from '../hooks/useSettings';

export const SettingsManagementPage = () => {
    const {
        t,
        activeTab,
        setActiveTab,
        canManageDelivery,
        canManageCoupons,
        isAdmin,
        deliveryForm,
        isDeliveryLoading,
        isDeliveryDirty,
        updateDeliveryMutation,
        maintenanceForm,
        isMaintenanceLoading,
        isMaintenanceDirty,
        updateMaintenanceMutation,
    } = useSettings();

    if (!canManageDelivery && !canManageCoupons) {
        return null;
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    {t("admin.settings.title") || "Settings"}
                </h1>
                <p className="text-muted-foreground">
                    {t("admin.settings.subtitle") || "Manage website configuration, delivery settings, and coupons"}
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className={`grid w-full max-w-lg grid-cols-1 ${canManageDelivery && canManageCoupons && isAdmin ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                    {canManageDelivery && (
                        <TabsTrigger value="delivery">{t("admin.settings.delivery.label") || "Delivery"}</TabsTrigger>
                    )}
                    {canManageCoupons && (
                        <TabsTrigger value="coupons">{t("admin.settings.coupons.label") || "Coupons"}</TabsTrigger>
                    )}
                    {isAdmin && (
                        <TabsTrigger value="maintenance">{t("admin.settings.maintenance.label") || "Maintenance"}</TabsTrigger>
                    )}
                </TabsList>

                {/* Delivery Tab */}
                {canManageDelivery && (
                    <TabsContent value="delivery" className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Coins className="h-5 w-5 text-primary" />
                                    {t("admin.settings.currency.cardTitle", { defaultValue: "Store currency" })}
                                </CardTitle>
                                <CardDescription>
                                    {t("admin.settings.currency.cardDesc", { defaultValue: "Store prices, taxes, delivery amounts, and order calculations are stored in immutable INR." })}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">
                                                {t("admin.settings.currency.baseLabel", { defaultValue: "Base currency" })}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {t("admin.settings.currency.baseDesc", { defaultValue: "This value is fixed for production-grade accounting consistency and cannot be changed from admin settings." })}
                                            </p>
                                        </div>
                                        <div className="rounded-md border border-primary/20 bg-primary/10 px-3 py-2 text-sm font-bold text-primary">
                                            INR
                                        </div>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {t("admin.settings.currency.immutableNote", { defaultValue: "End users can still choose a display currency in the storefront, but all source amounts remain canonical INR." })}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Truck className="h-5 w-5 text-primary" />
                                    {t("admin.settings.delivery.cardTitle")}
                                </CardTitle>
                                <CardDescription>
                                    {t("admin.settings.delivery.cardDesc")}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {isDeliveryLoading ? (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Skeleton className="h-4 w-32" />
                                                <Skeleton className="h-10 w-full" />
                                                <Skeleton className="h-3 w-48" />
                                            </div>
                                            <div className="space-y-2">
                                                <Skeleton className="h-4 w-32" />
                                                <Skeleton className="h-10 w-full" />
                                                <Skeleton className="h-3 w-48" />
                                            </div>
                                        </div>
                                        <Skeleton className="h-10 w-32" />
                                    </div>
                                ) : (
                                    <Form {...deliveryForm}>
                                        <form
                                            onSubmit={(e) => {
                                                e.preventDefault();
                                                deliveryForm.handleSubmit((data) =>
                                                    updateDeliveryMutation.mutateAsync(data)
                                                )(e);
                                            }}
                                            className="space-y-6"
                                        >
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <FormField
                                                    control={deliveryForm.control}
                                                    name="delivery_threshold"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>{t("admin.settings.delivery.thresholdLabel")}</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="number"
                                                                    placeholder="1500"
                                                                    {...field}
                                                                    onChange={(e) => field.onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                                                    className="transition-all hover:border-primary/50 focus:border-primary"
                                                                />
                                                            </FormControl>
                                                            <FormDescription>
                                                                {t("admin.settings.delivery.thresholdDesc")}
                                                            </FormDescription>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <FormField
                                                    control={deliveryForm.control}
                                                    name="delivery_charge"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>{t("admin.settings.delivery.chargeLabel")}</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="number"
                                                                    placeholder="50"
                                                                    {...field}
                                                                    onChange={(e) => field.onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                                                    className="transition-all hover:border-primary/50 focus:border-primary"
                                                                />
                                                            </FormControl>
                                                            <FormDescription>
                                                                {t("admin.settings.delivery.chargeDesc")}
                                                            </FormDescription>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={deliveryForm.control}
                                                    name="delivery_gst_mode"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>{t("admin.settings.delivery.gstModeLabel", { defaultValue: "Delivery GST mode" })}</FormLabel>
                                                            <Select onValueChange={field.onChange} value={field.value}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder={t("admin.settings.delivery.gstModePlaceholder", { defaultValue: "Select GST mode" })} />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="inclusive">
                                                                        {t("admin.settings.delivery.gstModeInclusive", { defaultValue: "Inclusive" })}
                                                                    </SelectItem>
                                                                    <SelectItem value="exclusive">
                                                                        {t("admin.settings.delivery.gstModeExclusive", { defaultValue: "Exclusive" })}
                                                                    </SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <FormDescription>
                                                                {t("admin.settings.delivery.gstModeDesc", { defaultValue: "Inclusive means the configured delivery charge already contains GST. Exclusive means GST is added on top of the configured delivery charge." })}
                                                            </FormDescription>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <FormField
                                                    control={deliveryForm.control}
                                                    name="delivery_gst"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>{t("admin.settings.delivery.gstLabel")}</FormLabel>
                                                            <Select
                                                                onValueChange={(value) => field.onChange(parseInt(value))}
                                                                value={field.value?.toString() ?? "0"}
                                                            >
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder={t("admin.settings.gst.placeholder")} />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {[0, 5, 12, 18, 28].map((rate) => (
                                                                        <SelectItem key={rate} value={rate.toString()}>
                                                                            {rate}%
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <FormDescription>
                                                                {t("admin.settings.delivery.gstDesc")}
                                                            </FormDescription>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>

                                            <Button
                                                type="submit"
                                                disabled={updateDeliveryMutation.isPending || !isDeliveryDirty}
                                                className="w-full md:w-auto transition-transform hover:scale-105"
                                            >
                                                {updateDeliveryMutation.isPending ? t("admin.settings.actions.saving") : t("admin.settings.actions.saveChanges")}
                                            </Button>
                                        </form>
                                    </Form>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}

                {/* Coupons Tab */}
                {canManageCoupons && (
                    <TabsContent value="coupons" className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
                        <CouponsManagement />
                    </TabsContent>
                )}

                {/* Maintenance Tab */}
                {isAdmin && (
                    <TabsContent value="maintenance" className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
                        <Card className="border-destructive/20 overflow-hidden">
                            <div className="h-1.5 w-full bg-destructive/60" />
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-destructive">
                                    <Hammer className="h-5 w-5" />
                                    {t("admin.settings.maintenance.cardTitle", { defaultValue: "Maintenance Mode" })}
                                </CardTitle>
                                <CardDescription>
                                    {t("admin.settings.maintenance.cardDesc", { defaultValue: "Force the website into maintenance mode. All non-whitelisted users will see the offline overlay." })}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {isMaintenanceLoading ? (
                                    <div className="space-y-6">
                                        <Skeleton className="h-24 w-full rounded-xl" />
                                        <div className="space-y-2">
                                            <Skeleton className="h-4 w-48" />
                                            <Skeleton className="h-10 w-full" />
                                            <Skeleton className="h-3 w-64" />
                                        </div>
                                        <Skeleton className="h-10 w-32" />
                                    </div>
                                ) : (
                                    <Form {...maintenanceForm}>
                                        <form
                                            onSubmit={(e) => {
                                                e.preventDefault();
                                                maintenanceForm.handleSubmit((data) =>
                                                    updateMaintenanceMutation.mutateAsync(data)
                                                )(e);
                                            }}
                                            className="space-y-6"
                                        >
                                            <div className="space-y-6">
                                                <FormField
                                                    control={maintenanceForm.control}
                                                    name="is_maintenance_mode"
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-row items-center justify-between rounded-xl border border-destructive/10 bg-destructive/5 p-4 py-6">
                                                            <div className="space-y-0.5">
                                                                <FormLabel className="text-base font-bold text-destructive">
                                                                    {t("admin.settings.maintenance.enableLabel", { defaultValue: "Activate Maintenance Mode" })}
                                                                </FormLabel>
                                                                <FormDescription className="text-destructive/60">
                                                                    {t("admin.settings.maintenance.enableDesc", { defaultValue: "Once enabled, the storefront and dashboard will be inaccessible to public users." })}
                                                                </FormDescription>
                                                            </div>
                                                            <FormControl>
                                                                <Switch
                                                                    checked={field.value}
                                                                    onCheckedChange={field.onChange}
                                                                    className="data-[state=checked]:bg-destructive"
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={maintenanceForm.control}
                                                    name="maintenance_bypass_ips"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="flex items-center gap-2">
                                                                <ShieldCheck className="h-4 w-4 text-green-600" />
                                                                {t("admin.settings.maintenance.bypassLabel", { defaultValue: "Admin Whitelist (Bypass IPs)" })}
                                                            </FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    placeholder="e.g. 192.168.1.1, 10.0.0.1"
                                                                    {...field}
                                                                    className="font-mono text-sm transition-all hover:border-primary/50 focus:border-primary"
                                                                />
                                                            </FormControl>
                                                            <FormDescription>
                                                                {t("admin.settings.maintenance.bypassDesc", { defaultValue: "Comma-separated list of IP addresses that can still access the site during maintenance." })}
                                                            </FormDescription>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>

                                            <Button
                                                type="submit"
                                                disabled={updateMaintenanceMutation.isPending || !isMaintenanceDirty}
                                                variant={maintenanceForm.watch('is_maintenance_mode') ? "destructive" : "default"}
                                                className="w-full md:w-auto transition-transform hover:scale-105 font-bold"
                                            >
                                                {updateMaintenanceMutation.isPending ? t("admin.settings.actions.saving") : t("admin.settings.actions.saveChanges")}
                                            </Button>
                                        </form>
                                    </Form>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
};
