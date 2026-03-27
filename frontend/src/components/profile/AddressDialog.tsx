import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Address } from "@/types";

interface AddressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address: Address | null;
  onSave: (address: Address) => void;
}

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

export function AddressDialog({
  open,
  onOpenChange,
  address,
  onSave,
}: AddressDialogProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Partial<Address>>({
    name: "",
    phone: "",
    pincode: "",
    locality: "",
    addressLine: "",
    city: "",
    state: "",
    country: "India",
    landmark: "",
    alternatePhone: "",
    addressType: "home",
    type: "shipping",
  });

  useEffect(() => {
    if (address) {
      setFormData(address);
    } else {
      setFormData({
        name: "",
        phone: "",
        pincode: "",
        locality: "",
        addressLine: "",
        city: "",
        state: "",
        country: "India",
        landmark: "",
        alternatePhone: "",
        addressType: "home",
        type: "shipping",
      });
    }
  }, [address, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as Address);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {address ? t("profile.address.refineSanctuary") : t("profile.address.establishSanctuary")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("profile.name")} *</Label>
              <Input
                id="name"
                value={formData.name || ""}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder={t("auth.namePlaceholder")}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t("profile.phone")} *</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone || ""}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder={t("profile.address.phonePlaceholder")}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pincode">{t("profile.zipcode")} *</Label>
              <Input
                id="pincode"
                value={formData.pincode || ""}
                onChange={(e) =>
                  setFormData({ ...formData, pincode: e.target.value })
                }
                placeholder={t("profile.address.postalPlaceholder")}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="locality">{t("profile.address.landmarkLabel")} *</Label>
              <Input
                id="locality"
                value={formData.locality || ""}
                onChange={(e) =>
                  setFormData({ ...formData, locality: e.target.value })
                }
                placeholder={t("profile.address.landmarkPlaceholder")}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="addressLine">{t("profile.addressLine")} *</Label>
            <Textarea
              id="addressLine"
              value={formData.addressLine || ""}
              onChange={(e) =>
                setFormData({ ...formData, addressLine: e.target.value })
              }
              placeholder={t("profile.address.housePlaceholder")}
              rows={3}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">{t("profile.city")} *</Label>
              <Input
                id="city"
                value={formData.city || ""}
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
                placeholder={t("profile.city")}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>{t("profile.state")} *</Label>
              <Select
                value={formData.state || ""}
                onValueChange={(value) =>
                  setFormData({ ...formData, state: value })
                }
              >
                <SelectTrigger aria-label={t("profile.state")}>
                  <SelectValue placeholder={t("profile.address.selectState")} />
                </SelectTrigger>
                <SelectContent>
                  {INDIAN_STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="landmark">{t("profile.address.landmarkLabel")} ({t("profile.address.optional")})</Label>
              <Input
                id="landmark"
                value={formData.landmark || ""}
                onChange={(e) =>
                  setFormData({ ...formData, landmark: e.target.value })
                }
                placeholder={t("profile.address.landmarkPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="alternatePhone">{t("profile.address.alternatePhoneLabel")} ({t("profile.address.optional")})</Label>
              <Input
                id="alternatePhone"
                type="tel"
                value={formData.alternatePhone || ""}
                onChange={(e) =>
                  setFormData({ ...formData, alternatePhone: e.target.value })
                }
                placeholder={t("profile.address.alternatePhonePlaceholder")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("profile.addressType")} *</Label>
            <RadioGroup
              value={formData.addressType || "home"}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  addressType: value as "home" | "work",
                })
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="home" id="home" />
                <Label className="font-normal">
                  {t("profile.address.typeHome")}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="work" id="work" />
                <Label className="font-normal">
                  {t("profile.address.typeWork")}
                </Label>
              </div>
            </RadioGroup>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit">{t("common.save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
