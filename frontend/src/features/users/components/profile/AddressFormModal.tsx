import { useEffect } from "react";
import { Button } from "@/shared/components/ui/button";
import { PhoneInput } from "@/shared/components/ui/phone-input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/components/ui/select";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Loader2, AlertCircle } from "lucide-react";
import { CheckoutAddress, CreateAddressDto } from "@/shared/types";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { useAddressForm } from "../../hooks/useAddressForm";

interface AddressFormModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (data: CreateAddressDto) => Promise<void | CheckoutAddress>;
    initialData?: Partial<CheckoutAddress>;
    availableTypes: Array<'home' | 'work' | 'other' | 'shipping' | 'billing' | 'both'>;
    profilePhone?: string;
}

export function AddressFormModal({

    open,
    onClose,
    onSave,
    initialData,
    availableTypes,
    profilePhone
}: AddressFormModalProps) {
    const {
        formData,
        setFormData,
        errors,
        loading,
        countries,
        currentStates,
        isLoadingCountries,
        isStatesLoading,
        isValidatingPostalCode,
        isValidatingPhone,
        locationError,
        originalPhone,
        handleInputChange,
        handleCountryChange,
        handleSubmit,
        resetForm,
        t,
    } = useAddressForm({ initialData, availableTypes, profilePhone, onSave, onClose });

    useEffect(() => {
        if (open) resetForm();
    }, [open, initialData?.id]);

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent 
                className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] border-none shadow-elevated p-0"
                onInteractOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
            >
                <div className="bg-muted/30 px-8 pt-8 pb-4 border-b border-border/40">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-playfair text-[#2C1810]">
                            {initialData ? t("profile.address.refineSanctuary") : t("profile.address.establishSanctuary")}
                        </DialogTitle>
                        <DialogDescription className="text-sm italic">
                            {initialData ? t("profile.address.refineDesc") : t("profile.address.establishDesc")}
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="px-8 pt-2 pb-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {errors.general && (
                            <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded">
                                {errors.general}
                            </div>
                        )}

                        {locationError && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{locationError}</AlertDescription>
                            </Alert>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-[11px] font-bold text-[#3d2b1f]">
                                    {t("profile.addressType")} <span className="text-destructive">*</span>
                                </Label>
                                <Select
                                    value={formData.type}
                                    onValueChange={(value: 'home' | 'work' | 'other' | 'shipping' | 'billing' | 'both') =>
                                        handleInputChange('type', value)
                                    }
                                    disabled={initialData?.type !== 'other' && !!initialData}
                                >
                                    <SelectTrigger aria-label={t("profile.addressType")}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableTypes.includes('home') && (
                                            <SelectItem value="home">{t("profile.address.typeHome")}</SelectItem>
                                        )}
                                        {availableTypes.includes('work') && (
                                            <SelectItem value="work">{t("profile.address.typeWork")}</SelectItem>
                                        )}
                                        <SelectItem value="other">{t("profile.address.typeOther")}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="full_name" className="text-[11px] font-bold text-[#3d2b1f]">{t("profile.address.fullNameLabel")}</Label>
                                <Input
                                    id="full_name"
                                    autoComplete="name"
                                    value={formData.full_name}
                                    onChange={(e) => handleInputChange('full_name', e.target.value)}
                                    placeholder={t("profile.address.fullNamePlaceholder")}
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="phone" className="text-[11px] font-bold text-[#3d2b1f]">
                                    {t("profile.phone")} <span className="text-destructive">*</span>
                                </Label>
                                {formData.phone && formData.phone === originalPhone && profilePhone && (
                                    <span className="text-[10px] text-primary/70 font-medium italic">
                                        ✓ Using your profile number
                                    </span>
                                )}
                            </div>
                            <PhoneInput
                                id="phone"
                                name="phone"
                                autoComplete="tel"
                                value={formData.phone}
                                onChange={(value) => handleInputChange('phone', value as string)}
                                placeholder={t("profile.address.phonePlaceholder")}
                                error={errors.phone}
                            />
                            {isValidatingPhone && (
                                <p className="text-xs text-muted-foreground">{t("common.validating", { defaultValue: "Validating..." })}</p>
                            )}
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="address_line1" className="text-[11px] font-bold text-[#3d2b1f]">
                                {t("profile.addressLine")} <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="address_line1"
                                autoComplete="address-line1"
                                value={formData.address_line1}
                                onChange={(e) => handleInputChange('address_line1', e.target.value)}
                                placeholder={t("profile.address.streetPlaceholder")}
                                className={errors.address_line1 ? 'border-destructive' : ''}
                            />
                            {errors.address_line1 && (
                                <p className="text-sm text-destructive">{errors.address_line1}</p>
                            )}
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="address_line2" className="text-[11px] font-bold text-[#3d2b1f]">{t("profile.address.apartmentLabel")}</Label>
                            <Input
                                id="address_line2"
                                autoComplete="address-line2"
                                value={formData.address_line2 || ''}
                                onChange={(e) => handleInputChange('address_line2', e.target.value)}
                                placeholder={t("profile.address.optional")}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-[11px] font-bold text-[#3d2b1f]">
                                    {t("profile.country")} <span className="text-destructive">*</span>
                                </Label>
                                <Select
                                    value={formData.country}
                                    onValueChange={handleCountryChange}
                                    disabled={isLoadingCountries}
                                >
                                    <SelectTrigger aria-label={t("profile.country")} className={errors.country ? 'border-destructive' : ''}>
                                        <SelectValue placeholder={isLoadingCountries ? t("profile.address.loadingCountries") : t("profile.address.selectCountry")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {countries.map((country) => (
                                            <SelectItem key={country.country} value={country.country}>
                                                {country.country} {country.phone_code ? `(${country.phone_code})` : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.country && (
                                    <p className="text-sm text-destructive">{errors.country}</p>
                                )}
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="state" className="text-[11px] font-bold text-[#3d2b1f]">
                                    {t("profile.state")} <span className="text-destructive">*</span>
                                </Label>
                                {currentStates.length > 0 ? (
                                    <Select
                                        value={formData.state}
                                        onValueChange={(value) => handleInputChange('state', value)}
                                        disabled={!formData.country || isStatesLoading}
                                    >
                                        <SelectTrigger aria-label={t("profile.state")} className={errors.state ? 'border-destructive' : ''}>
                                            <SelectValue placeholder={isStatesLoading ? t("profile.address.loadingStates") : t("profile.address.selectState")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {currentStates.map((state, index) => (
                                                <SelectItem key={`${state.name}_${index}`} value={state.name}>
                                                    {state.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <Input
                                        id="state"
                                        value={formData.state}
                                        onChange={(e) => handleInputChange('state', e.target.value)}
                                        placeholder={!formData.country ? t("profile.address.selectCountryFirst") : t("profile.address.enterState")}
                                        disabled={!formData.country}
                                        className={errors.state ? 'border-destructive' : ''}
                                    />
                                )}
                                {errors.state && (
                                    <p className="text-sm text-destructive">{errors.state}</p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label htmlFor="postal_code" className="text-[11px] font-bold text-[#3d2b1f]">
                                    {t("profile.zipcode")} <span className="text-destructive">*</span>
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="postal_code"
                                        value={formData.postal_code}
                                        onChange={(e) => handleInputChange('postal_code', e.target.value)}
                                        placeholder={t("profile.address.postalPlaceholder")}
                                        className={errors.postal_code ? 'border-destructive pr-8' : 'pr-8'}
                                    />
                                    {isValidatingPostalCode && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                        </div>
                                    )}
                                </div>
                                {errors.postal_code && (
                                    <p className="text-sm text-destructive">{errors.postal_code}</p>
                                )}
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="city" className="text-[11px] font-bold text-[#3d2b1f]">
                                    {t("profile.city")} <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="city"
                                    value={formData.city}
                                    onChange={(e) => handleInputChange('city', e.target.value)}
                                    placeholder={t("profile.address.cityPlaceholder")}
                                    className={errors.city ? 'border-destructive' : ''}
                                />
                                {errors.city && (
                                    <p className="text-sm text-destructive">{errors.city}</p>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="is_primary"
                                checked={formData.is_primary}
                                onCheckedChange={(checked) => handleInputChange('is_primary', checked as boolean)}
                            />
                            <Label className="cursor-pointer text-[11px] font-bold text-[#3d2b1f]">
                                {t("profile.address.setPrimaryAddress")}
                            </Label>
                        </div>

                        <DialogFooter className="pt-6 border-t border-dashed border-border/60">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={onClose}
                                className="rounded-full px-8 font-bold text-xs uppercase tracking-widest"
                            >
                                {t("profile.address.retreat")}
                            </Button>
                            <Button
                                type="submit"
                                disabled={loading}
                                className="rounded-full bg-[#2C1810] hover:bg-[#B85C3C] text-white px-10 font-bold text-xs uppercase tracking-widest shadow-lg transition-all"
                            >
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {initialData ? t("profile.address.confirmChange") : t("profile.address.establishPath")}
                            </Button>
                        </DialogFooter>
                    </form>
                </div>
            </DialogContent>
        </Dialog>
    );
}
