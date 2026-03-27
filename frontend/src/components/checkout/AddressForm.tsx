import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckoutMessages } from "@/constants/messages/CheckoutMessages";
import { CommonMessages } from "@/constants/messages/CommonMessages";
import type { CheckoutAddress, CreateAddressDto } from "@/types";

interface AddressFormProps {
    address?: CheckoutAddress;
    onSubmit: (data: CreateAddressDto) => void;
    onCancel: () => void;
    loading?: boolean;
}

export function AddressForm({ address, onSubmit, onCancel, loading }: AddressFormProps) {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<CreateAddressDto>({
        type: (address?.type === 'shipping' || address?.type === 'billing' || address?.type === 'both' ? address.type : 'shipping') as 'shipping' | 'billing' | 'both',
        full_name: address?.full_name || '',
        phone: address?.phone || '',
        address_line1: address?.address_line1 || '',
        address_line2: address?.address_line2 || '',
        city: address?.city || '',
        state: address?.state || '',
        postal_code: address?.postal_code || '',
        country: address?.country || t(CheckoutMessages.COUNTRY_INDIA),
        is_primary: address?.is_primary || false,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label>{t(CheckoutMessages.ADDRESS_TYPE)}</Label>
                    <Select
                        value={formData.type}
                        onValueChange={(value: 'shipping' | 'billing' | 'both') => setFormData({ ...formData, type: value })}
                    >
                        <SelectTrigger aria-label={t(CheckoutMessages.ADDRESS_TYPE)}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="shipping">{t(CheckoutMessages.ADDRESS_SHIPPING)}</SelectItem>
                            <SelectItem value="billing">{t(CheckoutMessages.ADDRESS_BILLING)}</SelectItem>
                            <SelectItem value="both">{t(CheckoutMessages.ADDRESS_BOTH)}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label htmlFor="full_name">{t(CheckoutMessages.FULL_NAME_LABEL)} *</Label>
                    <Input
                        id="full_name"
                        required
                        value={formData.full_name}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        autoComplete="name"
                    />
                </div>

                <div>
                    <Label htmlFor="phone">{t(CheckoutMessages.PHONE_LABEL)} *</Label>
                    <Input
                        id="phone"
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        autoComplete="tel"
                    />
                </div>

                <div className="md:col-span-2">
                    <Label htmlFor="address_line1">{t(CheckoutMessages.ADDRESS_LINE1)} *</Label>
                    <Input
                        id="address_line1"
                        required
                        value={formData.address_line1}
                        onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                        autoComplete="address-line1"
                    />
                </div>

                <div className="md:col-span-2">
                    <Label htmlFor="address_line2">{t(CheckoutMessages.ADDRESS_LINE2)}</Label>
                    <Input
                        id="address_line2"
                        value={formData.address_line2}
                        onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                        autoComplete="address-line2"
                    />
                </div>

                <div>
                    <Label htmlFor="city">{t(CheckoutMessages.CITY)} *</Label>
                    <Input
                        id="city"
                        required
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        autoComplete="address-level2"
                    />
                </div>

                <div>
                    <Label htmlFor="state">{t(CheckoutMessages.STATE)} *</Label>
                    <Input
                        id="state"
                        required
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        autoComplete="address-level1"
                    />
                </div>

                <div>
                    <Label htmlFor="postal_code">{t(CheckoutMessages.POSTAL_CODE)} *</Label>
                    <Input
                        id="postal_code"
                        required
                        value={formData.postal_code}
                        onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                        autoComplete="postal-code"
                    />
                </div>

                <div>
                    <Label htmlFor="country">{t(CheckoutMessages.COUNTRY)}</Label>
                    <Input
                        id="country"
                        value={formData.country}
                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                        autoComplete="country-name"
                    />
                </div>
            </div>

            <div className="flex items-center space-x-2">
                <Checkbox
                    id="is_primary"
                    checked={formData.is_primary}
                    onCheckedChange={(checked) =>
                        setFormData({ ...formData, is_primary: checked as boolean })
                    }
                />
                <Label className="cursor-pointer">
                    {t(CheckoutMessages.SET_PRIMARY)}
                </Label>
            </div>

            <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                    {t(CommonMessages.CANCEL)}
                </Button>
                <Button type="submit" disabled={loading}>
                    {loading ? t(CheckoutMessages.SAVING) : address ? t(CheckoutMessages.UPDATE_ADDRESS) : t(CheckoutMessages.ADD_ADDRESS)}
                </Button>
            </div>
        </form>
    );
}
