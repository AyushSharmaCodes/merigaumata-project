import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/lib/api';
import { toast } from 'sonner';
import { Coins, Truck, Tag } from 'lucide-react';
import { getErrorMessage } from '@/lib/errorUtils';
import CouponsManagement from './CouponsManagement';
import { useManagerPermissions } from '@/hooks/useManagerPermissions';
import type { CurrencySettings } from '@/types';

// Delivery Settings Schema
const deliverySchema = z.object({
  delivery_threshold: z.number().min(0, 'admin.settings.delivery.thresholdPositive'),
  delivery_charge: z.number().min(0, 'admin.settings.delivery.chargePositive'),
  delivery_gst: z.number().min(0, 'admin.settings.delivery.gstPositive').max(28, 'admin.settings.delivery.gstMax').default(0),
});

type DeliveryFormValues = z.infer<typeof deliverySchema>;

const currencySchema = z.object({
  base_currency: z.string().length(3, 'admin.settings.currency.invalid'),
});

type CurrencyFormValues = z.infer<typeof currencySchema>;

export default function SettingsManagement() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('delivery');
  const queryClient = useQueryClient();
  const { isAdmin, hasPermission } = useManagerPermissions();
  const canManageDelivery = isAdmin;
  const canManageCoupons = isAdmin || hasPermission('can_manage_coupons');

  const { data: currencySettings, isLoading: isCurrencyLoading } = useQuery<CurrencySettings>({
    queryKey: ['currencySettings'],
    queryFn: async () => {
      const response = await apiClient.get(endpoints.getCurrencySettings);
      return response.data;
    },
    enabled: canManageDelivery,
  });

  useEffect(() => {
    if (!canManageDelivery && canManageCoupons) {
      setActiveTab('coupons');
    }
  }, [canManageDelivery, canManageCoupons]);

  // Fetch Delivery Settings
  const { data: deliverySettings, isLoading: isDeliveryLoading } = useQuery<DeliveryFormValues>({
    queryKey: ['deliverySettings'],
    queryFn: async () => {
      const response = await apiClient.get(endpoints.getDeliverySettings);
      return response.data;
    },
    enabled: canManageDelivery,
  });

  // Defensive check for invalid API response (e.g. HTML error page)
  const safeSettings: Partial<DeliveryFormValues> = (deliverySettings && typeof deliverySettings === 'object')
    ? (deliverySettings as DeliveryFormValues)
    : {};

  // Delivery Form
  const deliveryForm = useForm<DeliveryFormValues>({
    resolver: zodResolver(deliverySchema),
    values: {
      delivery_threshold: safeSettings.delivery_threshold ?? 1500,
      delivery_charge: safeSettings.delivery_charge ?? 50,
      delivery_gst: safeSettings.delivery_gst ?? 0,
    },
  });

  const currencyForm = useForm<CurrencyFormValues>({
    resolver: zodResolver(currencySchema),
    values: {
      base_currency: currencySettings?.base_currency ?? 'INR',
    },
  });

  const isDeliveryDirty = deliveryForm.formState.isDirty;
  const isCurrencyDirty = currencyForm.formState.isDirty;

  // Update Delivery Settings Mutation
  const updateDeliveryMutation = useMutation({
    mutationFn: async (data: DeliveryFormValues) => {
      await apiClient.patch(endpoints.updateDeliverySettings, {
        threshold: data.delivery_threshold,
        charge: data.delivery_charge,
        gst: data.delivery_gst,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliverySettings'] });
      toast.success(t('admin.settings.delivery.saveSuccess', { defaultValue: 'Delivery settings updated successfully' }));
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, t, 'admin.settings.delivery.saveError'));
    },
  });

  const updateCurrencyMutation = useMutation({
    mutationFn: async (data: CurrencyFormValues) => {
      await apiClient.patch(endpoints.updateCurrencySettings, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currencySettings'] });
      queryClient.invalidateQueries({ queryKey: ['currencyContext'] });
      toast.success(t('admin.settings.currency.saveSuccess', { defaultValue: 'Base currency updated successfully' }));
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, t, 'admin.settings.currency.saveError'));
    },
  });

  if (!canManageDelivery && !canManageCoupons) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">{t("admin.settings.title") || "Settings"}</h1>
        <p className="text-muted-foreground">{t("admin.settings.subtitle") || "Manage website configuration, delivery settings, and coupons"}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={`grid w-full max-w-md ${canManageDelivery && canManageCoupons ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {canManageDelivery && (
            <TabsTrigger value="delivery">{t("admin.settings.delivery.label") || "Delivery"}</TabsTrigger>
          )}
          {canManageCoupons && (
            <TabsTrigger value="coupons">{t("admin.settings.coupons.label") || "Coupons"}</TabsTrigger>
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
                {t("admin.settings.currency.cardDesc", { defaultValue: "Choose the storefront default display currency. Stored catalog and order amounts remain in INR." })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isCurrencyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-muted-foreground animate-pulse">{t("admin.settings.currencyLoading", { defaultValue: "Loading currency settings..." })}</p>
                </div>
              ) : (
                <Form {...currencyForm}>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      currencyForm.handleSubmit((data) => updateCurrencyMutation.mutateAsync(data))(e);
                    }}
                    className="space-y-6"
                  >
                    <FormField
                      control={currencyForm.control}
                      name="base_currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("admin.settings.currency.baseLabel", { defaultValue: "Base currency" })}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t("admin.settings.currency.placeholder", { defaultValue: "Select a currency" })} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {(currencySettings?.supported_currencies || []).map((currency) => (
                                <SelectItem key={currency.code} value={currency.code}>
                                  {currency.label} ({currency.code})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            {t("admin.settings.currency.baseDesc", { defaultValue: "This controls the default storefront display currency only. Product prices and calculations are stored in canonical INR." })}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      disabled={updateCurrencyMutation.isPending || !isCurrencyDirty}
                      className="w-full md:w-auto transition-transform hover:scale-105"
                    >
                      {updateCurrencyMutation.isPending ? t("admin.settings.actions.saving") : t("admin.settings.actions.saveChanges")}
                    </Button>
                  </form>
                </Form>
              )}
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
                <div className="flex items-center justify-center py-8">
                  <p className="text-muted-foreground animate-pulse">{t("admin.settings.deliveryLoading") || "Loading delivery settings..."}</p>
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
          {/* Wrapping CouponsManagement to handle layout internally if needed, or just render it */}
          {/* Since CouponsManagement has its own layout, we might want to just render it. 
               However, it has a page-level header. It might be better to just let it be for now. */}
          <CouponsManagement />
        </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
