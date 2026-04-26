import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { MapPin, Plus, Edit, Trash2, Loader2 } from "lucide-react";
import { useAuthStore } from "@/domains/auth";
import { AddressDialog } from "./AddressDialog";
import { addressService } from "@/domains/user/services/address.service";
import { useToast } from "@/shared/hooks/use-toast";
import { logger } from "@/core/observability/logger";
import { getErrorMessage } from "@/core/utils/errorUtils";
import type { CheckoutAddress, Address } from "@/shared/types";
import { AddressCardSkeleton } from "@/shared/components/ui/page-skeletons";

export function AddressBook() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [addresses, setAddresses] = useState<CheckoutAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { toast } = useToast();


  const fetchAddresses = async () => {
    try {
      setLoading(true);
      const data = await addressService.getAddresses();
      setAddresses(data);
    } catch (error) {
      logger.error("Failed to fetch addresses", error);
      toast({
        title: t("common.error"),
        description: getErrorMessage(error, t, "profile.address.errorLoad"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAddresses();
    }
  }, [user]);

  const handleAddAddress = () => {
    setEditingAddress(null);
    setAddressDialogOpen(true);
  };

  const mapCheckoutAddressToAddress = (addr: CheckoutAddress): Address => ({
    id: addr.id,
    name: addr.full_name,
    phone: addr.phone,
    addressLine: addr.address_line1,
    locality: addr.address_line2 || '',
    city: addr.city,
    state: addr.state,
    pincode: addr.postal_code,
    addressType: addr.type,
    isDefault: addr.is_primary,
    country: addr.country,
    landmark: '',
    alternatePhone: ''
  });

  const handleEditAddress = (address: CheckoutAddress) => {
    setEditingAddress(mapCheckoutAddressToAddress(address));
    setAddressDialogOpen(true);
  };

  const handleDeleteAddress = async (addressId: string) => {
    try {
      setProcessingId(addressId);
      await addressService.deleteAddress(addressId);
      toast({
        title: t("common.success"),
        description: t("profile.address.successDelete"),
      });
      fetchAddresses();
    } catch (error) {
      logger.error("Failed to delete address", error);
      toast({
        title: t("common.error"),
        description: getErrorMessage(error, t, "profile.address.errorDelete"),
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleSaveAddress = async (addressData: Address) => {
    try {
      setProcessingId('saving-form');

      const payload = {
        id: addressData.id,
        full_name: addressData.name,
        phone: addressData.phone,
        address_line1: addressData.addressLine,
        address_line2: addressData.locality,
        city: addressData.city,
        state: addressData.state,
        postal_code: addressData.pincode,
        country: 'India', // Default
        type: addressData.addressType as 'home' | 'work' | 'other',
        is_primary: addressData.isDefault || false
      };

      if (editingAddress) {
        await addressService.updateAddress(editingAddress.id, payload);
        toast({
          title: t("common.success"),
          description: t("profile.address.successUpdate"),
        });
      } else {
        await addressService.createAddress(payload);
        toast({
          title: t("common.success"),
          description: t("profile.address.successAdd"),
        });
      }
      fetchAddresses();
      setAddressDialogOpen(false);
    } catch (error: unknown) {
      logger.error("Failed to save address", error);
      toast({
        title: t("common.error"),
        description: getErrorMessage(error, t, "profile.address.errorSave"),
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleSetDefault = async (addressId: string, type: 'home' | 'work' | 'other') => {
    try {
      setProcessingId(addressId);
      await addressService.setPrimary(addressId, type);
      toast({
        title: t("common.success"),
        description: t("profile.address.successPrimary"),
      });
      fetchAddresses();
    } catch (error) {
      logger.error("Failed to set primary address", error);
      toast({
        title: t("common.error"),
        description: getErrorMessage(error, t, "profile.address.errorPrimary"),
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-4 relative min-h-[200px]">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {t("profile.address.manageTitle")}
            </CardTitle>
            <Button onClick={handleAddAddress} disabled={!!processingId}>
              <Plus className="h-4 w-4 mr-2" />
              {t("profile.address.addNew")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
             <div className="space-y-4">
               {Array.from({ length: 3 }).map((_, i) => <AddressCardSkeleton key={i} />)}
             </div>
          ) : !addresses || addresses.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t("profile.address.noAddresses")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {addresses.map((address) => (
                <div
                  key={address.id}
                  className={`border rounded-lg p-4 space-y-3 transition-colors ${address.is_primary ? 'border-primary/50 bg-primary/5' : 'hover:bg-muted/50'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div>
                        <h3 className="font-semibold text-lg">
                          {address.full_name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {address.phone}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {address.is_primary && (
                          <Badge variant="default">{t("profile.default")}</Badge>
                        )}
                        <Badge variant="secondary" className="capitalize">
                          {address.type}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditAddress(address)}
                        disabled={!!processingId}
                      >
                        {processingId === address.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Edit className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteAddress(address.id)}
                        disabled={!!processingId}
                      >
                        {processingId === address.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>{address.address_line1}</p>
                    <p>{address.address_line2}</p>
                    <p>
                      {address.city}, {address.state} - {address.postal_code}
                    </p>
                  </div>
                  {!address.is_primary && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetDefault(address.id, address.type as 'home' | 'work' | 'other')}
                      className="w-full"
                      disabled={!!processingId}
                    >
                      {processingId === address.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      {t("profile.setAsDefault")}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AddressDialog
        open={addressDialogOpen}
        onOpenChange={setAddressDialogOpen}
        address={editingAddress}
        onSave={handleSaveAddress}
        isSaving={processingId === 'saving-form'}
      />
    </div>
  );
}
