import { logger } from "@/lib/logger";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Globe,
  Phone,
  Mail,
  MapPin,
  Clock,
  Send,
  Building2,
  Loader2,
} from "lucide-react";
import { SocialMediaSection } from "@/components/admin/contact/SocialMediaSection.tsx";
import { ContactInfoSection } from "@/components/admin/contact/ContactInfoSection.tsx";
import { OfficeHoursSection } from "@/components/admin/contact/OfficeHoursSection.tsx";
import { BankDetailsSection } from "@/components/admin/contact/BankDetailsSection.tsx";
import { contactInfoService } from "@/services/contact-info.service";
import { bankDetailsService } from "@/services/bank-details.service";
import { useTranslation } from "react-i18next";
import { useManagerPermissions } from "@/hooks/useManagerPermissions";

export default function ContactManagement() {
  const { t } = useTranslation();
  const { hasPermission, isAdmin } = useManagerPermissions();
  const queryClient = useQueryClient();
  const canManageSocial = isAdmin || hasPermission("can_manage_social_media");
  const canManageContactInfo = isAdmin || hasPermission("can_manage_contact_info");
  const canManageBank = isAdmin || hasPermission("can_manage_bank_details");
  const availableTabs = [
    canManageSocial ? "social" : null,
    canManageContactInfo ? "contact" : null,
    canManageContactInfo ? "hours" : null,
    canManageBank ? "bank" : null,
  ].filter(Boolean) as string[];
  const [activeTab, setActiveTab] = useState(availableTabs[0] || "social");

  const getGridColsClass = (len: number) => {
    switch (len) {
      case 1: return "grid-cols-1";
      case 2: return "grid-cols-2";
      case 3: return "grid-cols-3";
      case 4: return "grid-cols-4";
      default: return "grid-cols-4";
    }
  };

  // Fetch contact info - don't block on this
  const { data: contactInfo, isLoading: isLoadingContactInfo, error: contactInfoError } = useQuery({
    queryKey: ["contact-info"],
    queryFn: () => contactInfoService.getAll(true),
  });

  // Fetch bank details from database
  const { data: bankDetails = [], isLoading: isLoadingBankDetails } = useQuery({
    queryKey: ["bank-details"],
    queryFn: () => bankDetailsService.getAll(true),
  });

  // Show loading only if Contact Info tab is active and still loading
  if (activeTab === "contact" && isLoadingContactInfo) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="ml-2 text-muted-foreground">{t("admin.loading.info")}</p>
      </div>
    );
  }

  // Show error if contact info failed to load
  if (activeTab === "contact" && contactInfoError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-destructive mb-2">{t("admin.errors.loadInfo")}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          {t("admin.retry")}
        </Button>
      </div>
    );
  }

  if (availableTabs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">{t("auth.verifyingPermissions")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("admin.contact.management")}</h1>
        <p className="text-muted-foreground">
          {t("admin.contact.managementSubtitle")}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={`grid w-full ${getGridColsClass(availableTabs.length)}`}>
          {canManageSocial && <TabsTrigger value="social" className="gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">{t("admin.tabs.social")}</span>
          </TabsTrigger>}
          {canManageContactInfo && <TabsTrigger value="contact" className="gap-2">
            <Phone className="h-4 w-4" />
            <span className="hidden sm:inline">{t("admin.tabs.info")}</span>
          </TabsTrigger>}
          {canManageContactInfo && <TabsTrigger value="hours" className="gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">{t("admin.tabs.hours")}</span>
          </TabsTrigger>}
          {canManageBank && <TabsTrigger value="bank" className="gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">{t("admin.tabs.bank")}</span>
          </TabsTrigger>}
        </TabsList>

        {canManageSocial && <TabsContent value="social" className="space-y-4">
          <SocialMediaSection />
        </TabsContent>}

        {canManageContactInfo && <TabsContent value="contact" className="space-y-4">
          <ContactInfoSection
            phones={contactInfo?.phones || []}
            emails={contactInfo?.emails || []}
            address={contactInfo?.address || { address_line1: "", city: "", state: "", pincode: "", country: "" }}
          />
        </TabsContent>}

        {canManageContactInfo && <TabsContent value="hours" className="space-y-4">
          {isLoadingContactInfo ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <OfficeHoursSection
              officeHours={contactInfo?.officeHours || {
                monday: { isOpen: false, openTime: "09:00", closeTime: "17:00" },
                tuesday: { isOpen: false, openTime: "09:00", closeTime: "17:00" },
                wednesday: { isOpen: false, openTime: "09:00", closeTime: "17:00" },
                thursday: { isOpen: false, openTime: "09:00", closeTime: "17:00" },
                friday: { isOpen: false, openTime: "09:00", closeTime: "17:00" },
                saturday: { isOpen: false, openTime: "09:00", closeTime: "17:00" },
                sunday: { isOpen: false, openTime: "09:00", closeTime: "17:00" }
              }}
              onUpdate={async () => {
                queryClient.invalidateQueries({ queryKey: ["contact-info"] });
                queryClient.invalidateQueries({ queryKey: ["contact-info-public"] });
              }}
            />
          )}
        </TabsContent>}

        {canManageBank && <TabsContent value="bank" className="space-y-4">
          {isLoadingBankDetails ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <BankDetailsSection
              bankDetails={bankDetails}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ["bank-details"] })}
            />
          )}
        </TabsContent>}
      </Tabs>
    </div>
  );
}
