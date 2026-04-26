import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { CreateAddressDto, CheckoutAddress } from "@/shared/types";
import { useLocationStore } from "@/core/store/location.store";

interface UseAddressFormProps {
  initialData?: Partial<CheckoutAddress>;
  availableTypes: Array<'home' | 'work' | 'other' | 'shipping' | 'billing' | 'both'>;
  profilePhone?: string;
  onSave: (data: CreateAddressDto) => Promise<void | CheckoutAddress>;
  onClose: () => void;
}

export const useAddressForm = ({
  initialData,
  availableTypes,
  profilePhone,
  onSave,
  onClose,
}: UseAddressFormProps) => {
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
  const [originalPhone, setOriginalPhone] = useState<string>('');

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

  useEffect(() => {
    if (countryIso2) {
      fetchStates(countryIso2);
    }
  }, [countryIso2, fetchStates]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (formData.country === 'India' && /^\d{6}$/.test(formData.postal_code)) {
        const result = await validatePostalCode(formData.postal_code, countryIso2 || 'IN');
        if (result && result.isValid) {
          setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors.postal_code;
            return newErrors;
          });
          setFormData(prev => ({
            ...prev,
            city: result.city || prev.city,
            state: result.state || prev.state
          }));
        } else {
          setErrors(prev => ({ ...prev, postal_code: t("errors.address.invalidPostal") }));
        }
      } else {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.postal_code;
          return newErrors;
        });
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [formData.postal_code, formData.country, countryIso2, validatePostalCode, t]);

  const resetForm = () => {
    const isNewAddress = !initialData?.id;
    const initialPhone = isNewAddress ? (profilePhone || '') : (initialData?.phone || '');

    setFormData({
      type: initialData?.type || (availableTypes.includes('home') ? 'home' : availableTypes.includes('work') ? 'work' : 'other'),
      address_line1: initialData?.address_line1 || '',
      address_line2: initialData?.address_line2 || '',
      city: initialData?.city || '',
      state: initialData?.state || '',
      postal_code: initialData?.postal_code || '',
      country: initialData?.country || '',
      full_name: initialData?.full_name || '',
      phone: initialPhone,
      is_primary: initialData?.is_primary || false,
    });
    setOriginalPhone(initialPhone);

    if (initialData?.country) {
      const countryData = countries.find(c => c.country === initialData.country);
      if (countryData) {
        fetchStates(countryData.iso2);
        let phone = initialData.phone || '';
        if (phone && !phone.startsWith('+')) {
          phone = countryData.phone_code ? `${countryData.phone_code}${phone}` : `+91${phone}`;
          setFormData(prev => ({ ...prev, phone }));
          setOriginalPhone(phone);
        }
      }
    }
  };

  const handleInputChange = (field: keyof CreateAddressDto, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleCountryChange = (value: string) => {
    setFormData(prev => ({ ...prev, country: value, state: '' }));
    const country = countries.find(c => c.country === value);
    if (country) {
      fetchStates(country.iso2);
      if (!formData.phone || formData.phone.length < 4) {
        setFormData(prev => ({ ...prev, phone: country.phone_code || '' }));
      }
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.address_line1.trim()) newErrors.address_line1 = t("errors.address.streetRequired");
    if (!formData.city.trim()) newErrors.city = t("errors.address.cityRequired");
    if (!formData.state.trim()) newErrors.state = t("errors.address.stateRequired");
    if (!formData.country?.trim()) newErrors.country = t("errors.address.countryRequired");
    if (!formData.postal_code.trim()) newErrors.postal_code = t("errors.address.postalRequired");
    if (!formData.phone || formData.phone.trim().length < 13) newErrors.phone = t("errors.address.phoneRequiredTen");
    if (errors.postal_code) newErrors.postal_code = errors.postal_code;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const normalizedPhone = String(formData.phone || '').replace(/\s+/g, '').trim();
    const normalizedOriginalPhone = String(originalPhone || '').replace(/\s+/g, '').trim();

    setLoading(true);
    try {
      if (normalizedPhone && normalizedPhone !== normalizedOriginalPhone) {
        const result = await validatePhone(normalizedPhone);
        if (result && !result.isValid) {
          setErrors(prev => ({ ...prev, phone: result.error || t("errors.address.invalidPhone") }));
          return;
        }
      }

      await onSave({
        ...formData,
        address_line1: formData.address_line1.trim(),
        address_line2: formData.address_line2?.trim() || undefined,
        city: formData.city.trim(),
        state: formData.state.trim(),
        postal_code: formData.postal_code.trim(),
        full_name: formData.full_name.trim(),
        phone: formData.phone.trim(),
      });
      onClose();
    } catch (error) {
      setErrors({ general: t("profile.address.errorSave") });
    } finally {
      setLoading(false);
    }
  };

  return {
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
  };
};
