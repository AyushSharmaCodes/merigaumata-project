import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, Save, Info } from "lucide-react";
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
import { Switch } from "@/shared/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { useToast } from "@/shared/hooks/use-toast";
import { deliveryConfigService } from "@/domains/settings";
import { DeliveryConfig } from "@/shared/types";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { getErrorMessage } from "@/core/utils/errorUtils";

interface DeliveryConfigFormProps {
    productId: string;
    variantId?: string | null;
    value?: Partial<DeliveryConfig>;
    onChange?: (config: Partial<DeliveryConfig>) => void;
}

export function DeliveryConfigForm({ productId, variantId = null, value, onChange }: DeliveryConfigFormProps) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [localData, setLocalData] = useState<Partial<DeliveryConfig>>({
        calculation_type: "PER_ITEM",
        base_delivery_charge: 0,
        max_items_per_package: 3,
        gst_percentage: 0,
        delivery_refund_policy: "NON_REFUNDABLE",
        is_active: true,
    });

    const formData = value || localData;
    const isControlled = !!onChange;

    const updateData = (newData: Partial<DeliveryConfig>) => {
        if (isControlled && onChange) {
            onChange(newData);
        } else {
            setLocalData(newData);
        }
    };

    const { data: existingConfig, isLoading } = useQuery({
        queryKey: ["delivery-config", productId, variantId],
        queryFn: async () => {
            if (variantId || isControlled) return null;
            const data = await deliveryConfigService.getByProduct(productId);
            return data || null;
        },
        enabled: !!productId && !isControlled,
    });

    useEffect(() => {
        if (existingConfig && !isControlled) {
            setLocalData({
                ...existingConfig,
                gst_percentage: existingConfig.gst_percentage ?? 18,
                delivery_refund_policy: existingConfig.delivery_refund_policy ?? "NON_REFUNDABLE",
            });
        }
    }, [existingConfig, isControlled]);

    const mutation = useMutation({
        mutationFn: async (data: Partial<DeliveryConfig>) => {
            const scope = variantId ? 'VARIANT' : 'PRODUCT';

            return deliveryConfigService.create({
                ...data,
                scope,
                product_id: productId,
                variant_id: variantId,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["delivery-config", productId] });
            toast({
                title: t("common.success"),
                description: t("admin.delivery.toasts.saveSuccess"),
            });
        },
        onError: (error: unknown) => {
            toast({
                title: t("common.error"),
                description: getErrorMessage(error, t, "admin.delivery.toasts.saveError"),
                variant: "destructive",
            });
        },
    });

    const handleSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if ((formData.base_delivery_charge ?? 0) < 0) {
            toast({
                title: t("common.error"),
                description: t("admin.delivery.validation.chargeNonNegative", { defaultValue: "Delivery charge cannot be negative" }),
                variant: "destructive",
            });
            return;
        }
        if (formData.calculation_type === 'PER_PACKAGE' && (formData.max_items_per_package ?? 0) < 1) {
            toast({
                title: t("common.error"),
                description: t("admin.delivery.validation.itemsPerPackageMin", { defaultValue: "Items per package must be at least 1" }),
                variant: "destructive",
            });
            return;
        }
        if (formData.calculation_type === 'WEIGHT_BASED' && (formData.unit_weight ?? 0) <= 0) {
            toast({
                title: t("common.error"),
                description: t("admin.delivery.validation.weightPositive", { defaultValue: "Unit weight must be greater than 0" }),
                variant: "destructive",
            });
            return;
        }
        if (!isControlled) {
            mutation.mutate(formData);
        }
    };

    if (isLoading && !isControlled) {
        return <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <Card className="bg-muted/20 border-border/50 shadow-sm">
            <CardHeader className="pb-4">
                <CardTitle className="text-lg">{t("admin.delivery.title")}</CardTitle>
                <CardDescription>
                    {t("admin.delivery.description")}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-4">
                    <div className="flex items-center justify-between border p-3 rounded-lg bg-muted/20">
                        <div className="space-y-0.5">
                            <Label className="text-base">{t("admin.delivery.enableCustomRules")}</Label>
                            <p className="text-xs text-muted-foreground">
                                {t("admin.delivery.enableCustomRulesHint")}
                            </p>
                        </div>
                        <Switch
                            checked={formData.is_active ?? true}
                            onCheckedChange={(checked) => updateData({ ...formData, is_active: checked })}
                        />
                    </div>

                    {formData.is_active && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                            <div className="space-y-2">
                                <Label>{t("admin.delivery.calculationMethod")}</Label>
                                <Select
                                    value={formData.calculation_type || "PER_ITEM"}
                                    onValueChange={(val: any) => updateData({ ...formData, calculation_type: val })}
                                >
                                    <SelectTrigger aria-label={t("admin.delivery.calculationMethod")}>
                                        <SelectValue placeholder={t("admin.settings.gst.placeholder")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PER_ITEM">{t("admin.delivery.perItem")}</SelectItem>
                                        <SelectItem value="FLAT_PER_ORDER">{t("admin.delivery.flatRate")}</SelectItem>
                                        <SelectItem value="PER_PACKAGE">{t("admin.delivery.perPackage")}</SelectItem>
                                        <SelectItem value="WEIGHT_BASED">{t("admin.delivery.weightBased")}</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-[10px] text-muted-foreground">
                                    {t("admin.delivery.calculationHint")}
                                </p>
                            </div>

                            {formData.calculation_type === 'PER_PACKAGE' && (
                                <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                                    <Label>{t("admin.delivery.itemsPerPackage")}</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={formData.max_items_per_package ?? 3}
                                        onChange={(e) => updateData({ ...formData, max_items_per_package: parseInt(e.target.value) || 1 })}
                                    />
                                    <p className="text-[10px] text-muted-foreground">
                                        {t("admin.delivery.itemsPerPackageHint")}
                                    </p>
                                </div>
                            )}

                            {formData.calculation_type === 'WEIGHT_BASED' && (
                                <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                                    <Label>{t("admin.delivery.unitWeight")} (kg)</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="0.001"
                                        value={formData.unit_weight ?? 0.5}
                                        onChange={(e) => updateData({ ...formData, unit_weight: parseFloat(e.target.value) || 0 })}
                                    />
                                    <p className="text-[10px] text-muted-foreground">
                                        {t("admin.delivery.unitWeightHint")}
                                    </p>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>{t("admin.delivery.charge")}</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.base_delivery_charge ?? 0}
                                    onChange={(e) => updateData({ ...formData, base_delivery_charge: parseFloat(e.target.value) || 0 })}
                                />
                            </div>

                            <div className="flex items-center justify-between border p-3 rounded-lg bg-muted/20">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-medium">{t("admin.delivery.isTaxable")}</Label>
                                    <p className="text-xs text-muted-foreground">
                                        {t("admin.delivery.isTaxableHint")}
                                    </p>
                                </div>
                                <Switch
                                    checked={formData.is_taxable ?? true}
                                    onCheckedChange={(checked) => updateData({ ...formData, is_taxable: checked })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>{t("admin.delivery.gstRate")}</Label>
                                <Select
                                    value={formData.gst_percentage?.toString() ?? "0"}
                                    onValueChange={(val) => updateData({ ...formData, gst_percentage: parseFloat(val) })}
                                >
                                    <SelectTrigger aria-label={t("admin.delivery.gstRate")}>
                                        <SelectValue placeholder={t("admin.settings.gst.placeholder")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0">0%</SelectItem>
                                        <SelectItem value="5">5%</SelectItem>
                                        <SelectItem value="12">12%</SelectItem>
                                        <SelectItem value="18">18%</SelectItem>
                                        <SelectItem value="28">28%</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-[10px] text-muted-foreground">
                                    {t("admin.delivery.gstHint")}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label>{t("admin.delivery.refundPolicy")}</Label>
                                <Select
                                    value={formData.delivery_refund_policy || "NON_REFUNDABLE"}
                                    onValueChange={(val: any) => updateData({ ...formData, delivery_refund_policy: val })}
                                >
                                    <SelectTrigger aria-label={t("admin.delivery.refundPolicy")}>
                                        <SelectValue placeholder={t("admin.settings.gst.placeholder")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NON_REFUNDABLE">{t("admin.delivery.nonRefundable")}</SelectItem>
                                        <SelectItem value="REFUNDABLE">{t("admin.delivery.refundable")}</SelectItem>
                                    </SelectContent>
                                </Select>

                                {formData.delivery_refund_policy === 'NON_REFUNDABLE' ? (
                                    <Alert className="bg-primary/10 border-primary/20 py-2">
                                        <Info className="h-4 w-4 text-primary" />
                                        <AlertTitle className="text-xs font-bold text-primary">{t("admin.delivery.policyNote")}</AlertTitle>
                                        <AlertDescription className="text-xs text-primary/90">
                                            {t("admin.delivery.nonRefundableDesc")}
                                        </AlertDescription>
                                    </Alert>
                                ) : (
                                    <Alert className="bg-secondary/10 border-secondary/20 py-2">
                                        <Info className="h-4 w-4 text-secondary" />
                                        <AlertTitle className="text-xs font-bold text-secondary">{t("admin.delivery.policyNote")}</AlertTitle>
                                        <AlertDescription className="text-xs text-secondary/90">
                                            {t("admin.delivery.refundableDesc")}
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        </div>
                    )}

                    {!isControlled && (
                        <Button type="button" onClick={() => handleSubmit()} disabled={mutation.isPending} className="w-full">
                            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Save className="mr-2 h-4 w-4" />
                            {mutation.isPending ? t("admin.delivery.saving") : t("admin.delivery.save")}
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
