import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { userService } from "@/services/user.service";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { CreateUserDto } from "@/types";
import { useTranslation } from 'react-i18next';
import { validators } from "@/lib/validation";


interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserDialog({ open, onOpenChange }: UserDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    streetAddress: "",
    city: "",
    state: "",
    country: "",
    pincode: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) {
      // Reset form when dialog closes
      setFormData({
        name: "",
        email: "",
        phone: "",
        streetAddress: "",
        city: "",
        state: "",
        country: "",
        pincode: "",
      });
      setErrors({});
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Create new admin user with optional address
      // Note: In a real app, we should probably just send the core data
      // and let the backend handle ID generation and address association.

      const payload: CreateUserDto = {
        name: data.name,
        email: data.email,
        phone: data.phone,
        role: "admin",
        password: crypto.randomUUID(), // Backend should handle invite/reset flow
        // Logic for address could be sent here if backend supports it
      };

      await userService.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({
        title: t('common.success'),
        description: t('admin.users.dialog.createSuccess', { defaultValue: 'Admin user created successfully' }),
      });
      onOpenChange(false);
      setFormData({
        name: "",
        email: "",
        phone: "",
        streetAddress: "",
        city: "",
        state: "",
        country: "",
        pincode: "",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.error'),
        description: getErrorMessage(error, t, "admin.users.dialog.createError"),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = t('admin.users.dialog.errorNameRequired', { defaultValue: 'Name is required' });

    const emailValue = formData.email.trim();
    if (!emailValue) {
      newErrors.email = t('admin.users.dialog.errorEmailRequired', { defaultValue: 'Email is required' });
    } else {
      const emailError = validators.email(emailValue);
      if (emailError) newErrors.email = t(emailError);
    }

    if (!formData.phone) {
      newErrors.phone = t('admin.users.dialog.errorPhoneRequired', { defaultValue: 'Phone is required' });
    } else {
      const phoneError = validators.phone(formData.phone);
      if (phoneError) newErrors.phone = t(phoneError);
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast({
        title: t('common.error'),
        description: t('admin.users.dialog.requiredFields', { defaultValue: 'Please fill in all required fields' }),
        variant: "destructive",
      });
      return;
    }

    setErrors({});
    mutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-4xl max-h-[90vh]"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl">{t('admin.users.dialog.addTitle')}</DialogTitle>
          <DialogDescription>
            {t('admin.users.dialog.addDescription', { defaultValue: 'Create a new administrator account with full access' })}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-200px)] pr-4">
          <form onSubmit={handleSubmit} className="space-y-6 py-2">
            {/* Basic Information */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-base font-semibold">{t('admin.users.dialog.basicInfo', { defaultValue: 'Basic Information' })}</h3>

              <div className="space-y-2">
                <Label htmlFor="name">
                  {t('admin.users.dialog.fullName')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (errors.name) setErrors(prev => ({ ...prev, name: "" }));
                  }}
                  placeholder={t('admin.users.dialog.enterFullName')}
                  required
                  className={errors.name ? "border-destructive" : ""}
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    if (errors.email) setErrors(prev => ({ ...prev, email: "" }));
                  }}
                  placeholder={t('admin.users.dialog.enterEmail')}
                  required
                  className={errors.email ? "border-destructive" : ""}
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">
                  Phone Number <span className="text-destructive">*</span>
                </Label>
                <PhoneInput
                  id="phone"
                  value={formData.phone}
                  onChange={(value) => {
                    setFormData({ ...formData, phone: value as string });
                    if (errors.phone) setErrors(prev => ({ ...prev, phone: "" }));
                  }}
                  placeholder={t('admin.users.dialog.enterPhone')}
                  required
                  error={errors.phone}
                />
              </div>
            </div>

            {/* Address Information (Optional) */}
            <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
              <div>
                <h3 className="text-base font-semibold">{t('admin.users.dialog.addressInfo')}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Optional - Provide address details if available
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="streetAddress">{t('admin.users.dialog.streetAddress')}</Label>
                <Input
                  id="streetAddress"
                  value={formData.streetAddress}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      streetAddress: e.target.value,
                    })
                  }
                  placeholder={t('admin.users.dialog.enterStreet')}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">{t('admin.users.dialog.city')}</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                    placeholder={t('admin.users.dialog.enterCity')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">{t('admin.users.dialog.state')}</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) =>
                      setFormData({ ...formData, state: e.target.value })
                    }
                    placeholder={t('admin.users.dialog.enterState')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="country">{t('admin.users.dialog.country')}</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) =>
                      setFormData({ ...formData, country: e.target.value })
                    }
                    placeholder={t('admin.users.dialog.enterCountry')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pincode">{t('admin.users.dialog.pinCode')}</Label>
                  <Input
                    id="pincode"
                    value={formData.pincode}
                    onChange={(e) =>
                      setFormData({ ...formData, pincode: e.target.value })
                    }
                    placeholder={t('admin.users.dialog.enterPinCode')}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Adding..." : "Add Admin"}
              </Button>
            </DialogFooter>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
