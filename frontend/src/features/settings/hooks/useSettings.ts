import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { apiClient } from '@/core/api/api-client';
import { endpoints } from '@/core/api/api-client';
import { useToast } from "@/shared/hooks/use-toast";
import { getErrorMessage } from '@/core/utils/errorUtils';
import { useManagerPermissions } from '@/shared/hooks/useManagerPermissions';

// Delivery Settings Schema
const deliverySchema = z.object({
  delivery_threshold: z.number().min(0, 'admin.settings.delivery.thresholdPositive'),
  delivery_charge: z.number().min(0, 'admin.settings.delivery.chargePositive'),
  delivery_gst: z.number().min(0, 'admin.settings.delivery.gstPositive').max(28, 'admin.settings.delivery.gstMax').default(0),
  delivery_gst_mode: z.enum(['inclusive', 'exclusive']).default('inclusive'),
});

export type DeliveryFormValues = z.infer<typeof deliverySchema>;

// Maintenance Settings Schema
const maintenanceSchema = z.object({
  is_maintenance_mode: z.boolean().default(false),
  maintenance_bypass_ips: z.string().default(''),
});

export type MaintenanceFormValues = z.infer<typeof maintenanceSchema>;

export function useSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('delivery');
  const queryClient = useQueryClient();
  const { isAdmin, hasPermission } = useManagerPermissions();
  const canManageDelivery = isAdmin || hasPermission('can_manage_delivery_configs');
  const canManageCoupons = isAdmin || hasPermission('can_manage_coupons');

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
      delivery_gst_mode: safeSettings.delivery_gst_mode ?? 'inclusive',
    },
  });

  const isDeliveryDirty = deliveryForm.formState.isDirty;

  // Update Delivery Settings Mutation
  const updateDeliveryMutation = useMutation({
    mutationFn: async (data: DeliveryFormValues) => {
      await apiClient.patch(endpoints.updateDeliverySettings, {
        threshold: data.delivery_threshold,
        charge: data.delivery_charge,
        gst: data.delivery_gst,
        gst_mode: data.delivery_gst_mode,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliverySettings'] });
      toast({
        title: t('common.success'),
        description: t('admin.settings.delivery.saveSuccess', { defaultValue: 'Delivery settings updated successfully' }),
      });
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.error'),
        description: getErrorMessage(error, t, 'admin.settings.delivery.saveError'),
        variant: "destructive",
      });
    },
  });

  // Fetch Maintenance Settings
  const { data: maintenanceSettings, isLoading: isMaintenanceLoading } = useQuery<MaintenanceFormValues>({
    queryKey: ['maintenanceSettings'],
    queryFn: async () => {
      const response = await apiClient.get(endpoints.getMaintenanceSettings);
      return response.data;
    },
    enabled: isAdmin,
  });

  // Maintenance Form
  const maintenanceForm = useForm<MaintenanceFormValues>({
    resolver: zodResolver(maintenanceSchema),
    values: {
      is_maintenance_mode: maintenanceSettings?.is_maintenance_mode ?? false,
      maintenance_bypass_ips: maintenanceSettings?.maintenance_bypass_ips ?? '',
    },
  });

  const isMaintenanceDirty = maintenanceForm.formState.isDirty;

  // Update Maintenance Settings Mutation
  const updateMaintenanceMutation = useMutation({
    mutationFn: async (data: MaintenanceFormValues) => {
      await apiClient.patch(endpoints.updateMaintenanceSettings, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenanceSettings'] });
      toast({
        title: t('common.success'),
        description: t('admin.settings.maintenance.saveSuccess', { defaultValue: 'Maintenance settings updated successfully' }),
      });
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.error'),
        description: getErrorMessage(error, t, 'admin.settings.maintenance.saveError'),
        variant: "destructive",
      });
    },
  });

  return {
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
  };
}
