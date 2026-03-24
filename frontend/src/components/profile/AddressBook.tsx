import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Plus, Edit, Trash2, Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { AddressDialog } from "./AddressDialog";
import { addressService } from "@/services/address.service";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { getErrorMessage } from "@/lib/errorUtils";
import type { CheckoutAddress, Address } from "@/types";
import { LoadingOverlay } from "@/components/ui/loading-overlay";

export function AddressBook() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [addresses, setAddresses] = useState<CheckoutAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  const fetchAddresses = async () => {
    try {
      setLoading(true);
      const data = await addressService.getAddresses();
      setAddresses(data);
    } catch (error) {
      logger.error("Failed to fetch addresses", error);
      toast.error(getErrorMessage(error, t, "profile.address.errorLoad"));
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
      setActionLoading(true);
      setActionMessage(t("profile.address.removing"));
      await addressService.deleteAddress(addressId);
      toast.success(t("profile.address.successDelete"));
      fetchAddresses();
    } catch (error) {
      logger.error("Failed to delete address", error);
      toast.error(getErrorMessage(error, t, "profile.address.errorDelete"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveAddress = async (addressData: Address) => {
    try {
      setActionLoading(true);
      setActionMessage(editingAddress ? t("profile.address.updating") : t("profile.address.saving"));

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
        toast.success(t("profile.address.successUpdate"));
      } else {
        await addressService.createAddress(payload);
        toast.success(t("profile.address.successAdd"));
      }
      fetchAddresses();
      setAddressDialogOpen(false);
    } catch (error: unknown) {
      logger.error("Failed to save address", error);
      toast.error(getErrorMessage(error, t, "profile.address.errorSave"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetDefault = async (addressId: string, type: 'home' | 'work' | 'other') => {
    try {
      setActionLoading(true);
      setActionMessage(t("profile.address.settingPrimary"));
      await addressService.setPrimary(addressId, type);
      toast.success(t("profile.address.successPrimary"));
      fetchAddresses();
    } catch (error) {
      logger.error("Failed to set primary address", error);
      toast.error(getErrorMessage(error, t, "profile.address.errorPrimary"));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-4 relative min-h-[200px]">
      <LoadingOverlay isLoading={loading || actionLoading} message={actionLoading ? actionMessage : t("profile.address.gettingAddresses")} />
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {t("profile.address.manageTitle")}
            </CardTitle>
            <Button onClick={handleAddAddress}>
              <Plus className="h-4 w-4 mr-2" />
              {t("profile.address.addNew")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!loading && (!addresses || addresses.length === 0) ? (
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
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteAddress(address.id)}
                      >
                        <Trash2 className="h-4 w-4" />
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
                    >
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
      />
    </div>
  );
}
