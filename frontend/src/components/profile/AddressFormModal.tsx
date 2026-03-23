import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
import { Loader2, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { CheckoutAddress, CreateAddressDto } from "@/types";
import { useLocationStore } from "@/store/locationStore";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getErrorMessage } from "@/lib/errorUtils";


interface AddressFormModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (data: CreateAddressDto) => Promise<void | CheckoutAddress>;
    initialData?: Partial<CheckoutAddress>;
    availableTypes: Array<'home' | 'work' | 'other' | 'shipping' | 'billing' | 'both'>;
}

interface Country {
    country: string;
    iso2: string;
}

interface State {
    name: string;
    state_code: string;
}

export default function AddressFormModal({
    open,
    onClose,
    onSave,
    initialData,
    availableTypes
}: AddressFormModalProps) {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<CreateAddressDto>({
        type: 'other',
        address_line1: '',
        address_line2: '',
        city: '',
        state: '',
        postal_code: '',
        country: '',
        full_name: '',
        phone: '',
        is_primary: false,
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);

    // Location Store
    const {
        countries,
        states: statesMap,
        isLoadingCountries,
        isLoadingStates: loadingStatesMap,
        fetchStates,
        validatePostalCode,
        isValidatingPostalCode,
        isValidatingPhone,
        validatePhone,
        error: locationError
    } = useLocationStore();

    const selectedCountry = countries.find(c => c.country === formData.country);
    const countryIso2 = selectedCountry?.iso2;

    const currentStates = countryIso2 ? (statesMap[countryIso2] || []) : [];
    const isStatesLoading = countryIso2 ? (loadingStatesMap[countryIso2] || false) : false;
    const [apiError, setApiError] = useState<string | null>(null);

    // State Fetching Effect
    useEffect(() => {
        if (countryIso2) {
            fetchStates(countryIso2);
        }
    }, [countryIso2, fetchStates]);

    // Postal Code Validation Effect
    useEffect(() => {
        const timer = setTimeout(async () => {
            // Only validate if country is India
            if (formData.country === 'India' && formData.postal_code) {
                const result = await validatePostalCode(formData.postal_code, countryIso2 || 'IN');
                if (result && result.isValid) {
                    setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors.postal_code;
                        return newErrors;
                    });

                    // Auto-fill City and State if available and not manually set (or just overwrite)
                    setFormData(prev => ({
                        ...prev,
                        city: result.city || prev.city,
                        state: result.state || prev.state
                    }));
                } else {
                    setErrors(prev => ({ ...prev, postal_code: t("errors.address.invalidPostal") }));
                }
            } else {
                // If not India, clear postal code error if it exists so we don't block submission
                setErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors.postal_code;
                    return newErrors;
                });
            }
        }, 800);

        return () => clearTimeout(timer);
    }, [formData.postal_code, formData.country, countryIso2, validatePostalCode, t]);

    // Phone Validation Effect
    useEffect(() => {
        if (!formData.phone || formData.phone.length < 10) return;

        const timer = setTimeout(async () => {
            const result = await validatePhone(formData.phone);
            if (result && !result.isValid) {
                setErrors(prev => ({ ...prev, phone: result.error || t("errors.address.invalidPhone") }));
            } else {
                setErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors.phone;
                    return newErrors;
                });
            }
        }, 1000);

        return () => clearTimeout(timer);
    }, [formData.phone, validatePhone, t]);

    useEffect(() => {
        if (initialData) {
            setFormData({
                type: initialData.type || 'other',
                address_line1: initialData.address_line1 || '',
                address_line2: initialData.address_line2 || '',
                city: initialData.city || '',
                state: initialData.state || '',
                postal_code: initialData.postal_code || '',
                country: initialData.country || '',
                full_name: initialData.full_name || '',
                phone: initialData.phone || '',
                is_primary: initialData.is_primary || false,
            });

            if (initialData.country) {
                const countryData = countries.find(c => c.country === initialData.country);
                if (countryData) {
                    fetchStates(countryData.iso2);

                    // Normalize phone number if it's not in E.164 format
                    let phone = initialData.phone || '';
                    if (phone && !phone.startsWith('+')) {
                        // If it looks like a valid number but missing plus, prepend it
                        // Try to use country code if available
                        if (countryData.phone_code) {
                            phone = `${countryData.phone_code}${phone}`;
                        } else {
                            // Fallback to +91 if no country code found
                            phone = `+91${phone}`;
                        }
                        setFormData(prev => ({ ...prev, phone }));
                    }
                }
            }
        } else {
            setFormData({
                type: availableTypes.includes('home') ? 'home' : availableTypes.includes('work') ? 'work' : 'other',
                address_line1: '',
                address_line2: '',
                city: '',
                state: '',
                postal_code: '',
                country: '',
                full_name: '',
                phone: '',
                is_primary: false,
            });
        }
    }, [initialData, open, availableTypes, fetchStates, countries]);

    const handleCountryChange = (value: string) => {
        setFormData(prev => ({ ...prev, country: value, state: '' }));
        const country = countries.find(c => c.country === value);
        if (country) {
            fetchStates(country.iso2);
            // If phone is empty or just has old code, update it to new country code
            if (!formData.phone || formData.phone.length < 4) {
                setFormData(prev => ({ ...prev, phone: country.phone_code || '' }));
            }
        }
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.address_line1.trim()) {
            newErrors.address_line1 = t("errors.address.streetRequired");
        }

        if (!formData.city.trim()) {
            newErrors.city = t("errors.address.cityRequired");
        }

        if (!formData.state.trim()) {
            newErrors.state = t("errors.address.stateRequired");
        }

        if (!formData.country?.trim()) {
            newErrors.country = t("errors.address.countryRequired");
        }

        if (!formData.postal_code.trim()) {
            newErrors.postal_code = t("errors.address.postalRequired");
        }

        if (!formData.phone || formData.phone.trim().length < 13) {
            newErrors.phone = t("errors.address.phoneRequiredTen");
        }

        // If we have a validation error from the API check, keep it
        if (errors.postal_code) {
            newErrors.postal_code = errors.postal_code;
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        setLoading(true);
        try {
            await onSave({
                type: formData.type,
                address_line1: formData.address_line1.trim(),
                address_line2: formData.address_line2?.trim() || undefined,
                city: formData.city.trim(),
                state: formData.state.trim(),
                postal_code: formData.postal_code.trim(),
                country: formData.country,
                full_name: formData.full_name.trim(),
                phone: formData.phone.trim(),
                is_primary: formData.is_primary,
            });
            onClose();
        } catch (error: unknown) {
            setErrors({ general: getErrorMessage(error, t, "profile.address.errorSave") });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] border-none shadow-elevated p-0">
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

                        {(apiError || locationError) && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{apiError || locationError}</AlertDescription>
                            </Alert>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Type */}
                            <div className="space-y-1">
                                <Label htmlFor="type" className="text-[11px] font-bold text-[#3d2b1f]">
                                    {t("profile.addressType")} <span className="text-destructive">*</span>
                                </Label>
                                <Select
                                    value={formData.type}
                                    onValueChange={(value: 'home' | 'work' | 'other' | 'shipping' | 'billing' | 'both') =>
                                        setFormData({ ...formData, type: value })
                                    }
                                    disabled={initialData?.type !== 'other' && !!initialData}
                                >
                                    <SelectTrigger>
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
                                {formData.type !== 'other' && !availableTypes.includes(formData.type) && initialData && (
                                    <p className="text-xs text-muted-foreground">
                                        {t("profile.address.typeLocked")}
                                    </p>
                                )}
                            </div>

                            {/* Full Name (Label) */}
                            <div className="space-y-1">
                                <Label htmlFor="full_name" className="text-[11px] font-bold text-[#3d2b1f]">{t("profile.address.fullNameLabel")}</Label>
                                <Input
                                    id="full_name"
                                    value={formData.full_name}
                                    onChange={(e) =>
                                        setFormData({ ...formData, full_name: e.target.value })
                                    }
                                    placeholder={t("profile.address.fullNamePlaceholder")}
                                />
                            </div>
                        </div>

                        {/* Phone */}
                        <div className="space-y-1">
                            <Label htmlFor="phone" className="text-[11px] font-bold text-[#3d2b1f]">
                                {t("profile.phone")} <span className="text-destructive">*</span>
                            </Label>
                            <PhoneInput
                                id="phone"
                                value={formData.phone}
                                onChange={(value) =>
                                    setFormData({ ...formData, phone: value as string })
                                }
                                placeholder={t("profile.address.phonePlaceholder")}
                                error={errors.phone}
                            />
                        </div>

                        {/* Street Address */}
                        <div className="space-y-1">
                            <Label htmlFor="address_line1" className="text-[11px] font-bold text-[#3d2b1f]">
                                {t("profile.addressLine")} <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="address_line1"
                                value={formData.address_line1}
                                onChange={(e) =>
                                    setFormData({ ...formData, address_line1: e.target.value })
                                }
                                placeholder={t("profile.address.streetPlaceholder")}
                                className={errors.address_line1 ? 'border-destructive' : ''}
                            />
                            {errors.address_line1 && (
                                <p className="text-sm text-destructive">{errors.address_line1}</p>
                            )}
                        </div>

                        {/* Apartment */}
                        <div className="space-y-1">
                            <Label htmlFor="address_line2" className="text-[11px] font-bold text-[#3d2b1f]">{t("profile.address.apartmentLabel")}</Label>
                            <Input
                                id="address_line2"
                                value={formData.address_line2 || ''}
                                onChange={(e) =>
                                    setFormData({ ...formData, address_line2: e.target.value })
                                }
                                placeholder={t("profile.address.optional")}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Country */}
                            <div className="space-y-1">
                                <Label htmlFor="country" className="text-[11px] font-bold text-[#3d2b1f]">
                                    {t("profile.country")} <span className="text-destructive">*</span>
                                </Label>
                                <Select
                                    value={formData.country}
                                    onValueChange={handleCountryChange}
                                    disabled={isLoadingCountries}
                                >
                                    <SelectTrigger className={errors.country ? 'border-destructive' : ''}>
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

                            {/* State */}
                            <div className="space-y-1">
                                <Label htmlFor="state" className="text-[11px] font-bold text-[#3d2b1f]">
                                    {t("profile.state")} <span className="text-destructive">*</span>
                                </Label>
                                {currentStates.length > 0 ? (
                                    <Select
                                        value={formData.state}
                                        onValueChange={(value) =>
                                            setFormData({ ...formData, state: value })
                                        }
                                        disabled={!formData.country || isStatesLoading}
                                    >
                                        <SelectTrigger className={errors.state ? 'border-destructive' : ''}>
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
                                        onChange={(e) =>
                                            setFormData({ ...formData, state: e.target.value })
                                        }
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
                            {/* Postal Code */}
                            <div className="space-y-1">
                                <Label htmlFor="postal_code" className="text-[11px] font-bold text-[#3d2b1f]">
                                    {t("profile.zipcode")} <span className="text-destructive">*</span>
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="postal_code"
                                        value={formData.postal_code}
                                        onChange={(e) =>
                                            setFormData({ ...formData, postal_code: e.target.value })
                                        }
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

                            {/* City */}
                            <div className="space-y-1">
                                <Label htmlFor="city" className="text-[11px] font-bold text-[#3d2b1f]">
                                    {t("profile.city")} <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="city"
                                    value={formData.city}
                                    onChange={(e) =>
                                        setFormData({ ...formData, city: e.target.value })
                                    }
                                    placeholder={t("profile.address.cityPlaceholder")}
                                    className={errors.city ? 'border-destructive' : ''}
                                />
                                {errors.city && (
                                    <p className="text-sm text-destructive">{errors.city}</p>
                                )}
                            </div>
                        </div>

                        {/* Set as Primary */}
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="is_primary"
                                checked={formData.is_primary}
                                onCheckedChange={(checked) =>
                                    setFormData({ ...formData, is_primary: checked as boolean })
                                }
                            />
                            <Label htmlFor="is_primary" className="cursor-pointer text-[11px] font-bold text-[#3d2b1f]">
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
