import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, User, Mail, Phone, Shield, Lock, ChevronRight, UserCircle, Languages } from "lucide-react";
import { useEffect, useState } from "react";
import { PhoneInput } from "@/components/ui/phone-input";
import { useTranslation } from "react-i18next";
import { useLocationStore } from "@/store/locationStore";

interface PersonalInfoFormProps {
    initialData: {
        firstName: string;
        lastName?: string;
        gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
        email: string;
        phone?: string;
    };
    onSave: (data: {
        firstName: string;
        lastName?: string;
        gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
        phone?: string;
    }) => Promise<void>;
    loading?: boolean;
    onChangePassword?: () => void;
}

export default function PersonalInfoForm({
    initialData,
    onSave,
    loading = false,
    onChangePassword
}: PersonalInfoFormProps) {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        firstName: initialData.firstName || '',
        lastName: initialData.lastName || '',
        gender: initialData.gender || '',
        phone: initialData.phone || '',
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const { validatePhone, isValidatingPhone } = useLocationStore();

    useEffect(() => {
        setFormData({
            firstName: initialData.firstName || '',
            lastName: initialData.lastName || '',
            gender: initialData.gender || '',
            phone: initialData.phone || '',
        });
    }, [initialData]);

    // Phone Validation Effect
    useEffect(() => {
        if (!formData.phone || formData.phone.length < 10) return;

        const timer = setTimeout(async () => {
            const result = await validatePhone(formData.phone);
            if (result && !result.isValid) {
                setErrors(prev => ({ ...prev, phone: result.error || t("errors.auth.invalidPhone") }));
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

    const validate = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.firstName.trim()) {
            newErrors.firstName = t("errors.inventory.titleRequired"); // Or a more specific key if exists
        }

        if (!formData.phone || formData.phone.trim().length < 10) {
            newErrors.phone = t("errors.auth.invalidEmailPhone");
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        await onSave({
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim() || undefined,
            gender: (formData.gender as 'male' | 'female' | 'other' | 'prefer_not_to_say') || undefined,
            phone: formData.phone,
        });
    };

    const hasChanges = () => {
        return (
            formData.firstName !== (initialData.firstName || '') ||
            formData.lastName !== (initialData.lastName || '') ||
            formData.gender !== (initialData.gender || '') ||
            formData.phone !== (initialData.phone || '')
        );
    };

    return (
        <Card className="rounded-[2.5rem] border-none shadow-soft overflow-hidden bg-card text-card-foreground h-full relative">
            <div className="absolute top-6 right-6">
                <div className="h-3 w-3 rounded-full bg-[#a0f0a0] shadow-[0_0_10px_#a0f0a0]"></div>
            </div>
            <CardHeader className="pb-4 pt-6 px-8">
                <CardTitle className="text-xl font-bold font-playfair text-foreground lowercase first-letter:uppercase">{t("profile.personalInfo.bioAndOtherDetails")}</CardTitle>
            </CardHeader>
            <CardContent className="px-8 pb-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                        {/* First Name (Mapped to "My Role" style) */}
                        <div className="space-y-1 group">
                            <Label htmlFor="firstName" className="text-[11px] font-bold text-[#3d2b1f] group-hover:text-foreground transition-colors">
                                {t("profile.personalInfo.firstName")} <span className="text-red-500/50">*</span>
                            </Label>
                            <Input
                                id="firstName"
                                value={formData.firstName}
                                onChange={(e) =>
                                    setFormData({ ...formData, firstName: e.target.value })
                                }
                                autoComplete="given-name"
                                className={`h-auto p-0 border-0 border-b border-border bg-transparent rounded-none focus-visible:ring-0 focus-visible:border-primary/20 text-lg font-medium placeholder:text-muted-foreground/20 text-foreground ${errors.firstName ? 'border-red-400/50' : ''}`}
                            />
                            {errors.firstName && (
                                <p className="text-[10px] text-red-400 font-medium mt-1">{errors.firstName}</p>
                            )}
                        </div>

                        {/* Last Name (Mapped to "My Experience Level" style) */}
                        <div className="space-y-1 group">
                            <Label htmlFor="lastName" className="text-[11px] font-bold text-[#3d2b1f] group-hover:text-foreground transition-colors">
                                {t("profile.personalInfo.lastName")}
                            </Label>
                            <Input
                                id="lastName"
                                value={formData.lastName}
                                placeholder={t("profile.personalInfo.lastNamePlaceholder")}
                                onChange={(e) =>
                                    setFormData({ ...formData, lastName: e.target.value })
                                }
                                autoComplete="family-name"
                                className="h-auto p-0 border-0 border-b border-border bg-transparent rounded-none focus-visible:ring-0 focus-visible:border-primary/20 text-lg font-medium placeholder:text-muted-foreground/20 text-foreground"
                            />
                        </div>

                        {/* Email (Read-only styled similarly) */}
                        <div className="space-y-1 group opacity-60">
                            <Label htmlFor="email" className="text-[11px] font-bold text-[#3d2b1f]">
                                {t("profile.personalInfo.email")}
                            </Label>
                            <div className="flex items-center gap-2 border-b border-border py-1">
                                <span className="text-lg font-medium text-foreground">{initialData.email}</span>
                                <Shield className="h-3 w-3 text-muted-foreground/30" />
                            </div>
                        </div>

                        {/* Phone (Mapped to "My City or Region" style) */}
                        <div className="space-y-1 group">
                            <Label htmlFor="phone" className="text-[11px] font-bold text-[#3d2b1f] group-hover:text-foreground transition-colors">
                                {t("profile.personalInfo.mobile")} <span className="text-red-500/50">*</span>
                            </Label>
                            <div className="border-b border-border">
                                <PhoneInput
                                    id="phone"
                                    value={formData.phone}
                                    onChange={(val) => setFormData({ ...formData, phone: val })}
                                    error={errors.phone}
                                    required={true}
                                    className="bg-transparent border-0 p-0 focus-within:ring-0 text-foreground"
                                />
                            </div>
                        </div>

                        {/* Gender (Mapped to "Availability" style) */}
                        <div className="space-y-2 group md:col-span-2">
                            <Label htmlFor="gender" className="text-[11px] font-bold text-[#3d2b1f] group-hover:text-foreground transition-colors">
                                {t("profile.personalInfo.gender")}
                            </Label>
                            <Select
                                value={formData.gender}
                                onValueChange={(value) =>
                                    setFormData({ ...formData, gender: value })
                                }
                            >
                                <SelectTrigger className="w-fit min-w-[200px] h-10 rounded-full bg-muted border-border text-xs font-medium hover:bg-muted/80 focus:ring-0 transition-all text-foreground">
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-primary/40"></div>
                                        <SelectValue placeholder={t("profile.personalInfo.selectGender")} />
                                    </div>
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-border bg-card text-card-foreground shadow-2xl">
                                    <SelectItem value="male">{t("profile.personalInfo.male")}</SelectItem>
                                    <SelectItem value="female">{t("profile.personalInfo.female")}</SelectItem>
                                    <SelectItem value="other">{t("profile.personalInfo.other")}</SelectItem>
                                    <SelectItem value="prefer_not_to_say">
                                        {t("profile.personalInfo.preferNotToSay")}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-center gap-6 pt-6 border-t border-border">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onChangePassword}
                            className="w-full sm:w-auto text-muted-foreground/60 hover:text-foreground hover:bg-muted rounded-full font-bold text-[10px] uppercase tracking-widest px-6"
                        >
                            <Lock className="h-3 w-3 mr-2" /> {t("profile.personalInfo.changePassword")}
                        </Button>

                        {hasChanges() && (
                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full sm:w-auto bg-[#B85C3C] hover:bg-[#A04D30] text-white rounded-full font-bold text-[10px] uppercase tracking-widest px-10 h-11 transition-all active:scale-95"
                            >
                                {loading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                                {loading ? t("profile.personalInfo.saving") : t("profile.personalInfo.saveInfo")}
                            </Button>
                        )}
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
