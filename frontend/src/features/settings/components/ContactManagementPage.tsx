import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Button } from "@/shared/components/ui/button";
import {
  Globe,
  Phone,
  Clock,
  Building2,
  Loader2,
} from "lucide-react";
import { SocialMediaSection } from "@/features/admin/contact";
import { ContactInfoSection } from "@/features/admin/contact";
import { OfficeHoursSection } from "@/features/admin/contact";
import { BankDetailsSection } from "@/features/admin/contact";
import { useContactManagement } from "../hooks/useContactManagement";

export const ContactManagementPage = () => {
    const {
        t,
        activeTab,
        setActiveTab,
        availableTabs,
        canManageSocial,
        canManageContactInfo,
        canManageBank,
        contactInfo,
        isLoadingContactInfo,
        contactInfoError,
        bankDetails,
        isLoadingBankDetails,
        queryClient
    } = useContactManagement();

    const getGridColsClass = (len: number) => {
        switch (len) {
            case 1: return "grid-cols-1";
            case 2: return "grid-cols-2";
            case 3: return "grid-cols-3";
            case 4: return "grid-cols-4";
            default: return "grid-cols-4";
        }
    };

    if (activeTab === "contact" && isLoadingContactInfo) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="ml-2 text-muted-foreground">{t("admin.loading.info")}</p>
            </div>
        );
    }

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
};
