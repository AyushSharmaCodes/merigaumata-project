import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useManagerPermissions } from "@/shared/hooks/useManagerPermissions";
import { settingsApi } from "@/domains/settings";
import { bankDetailsService } from "@/domains/donation";

export function useContactManagement() {
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

    const { data: contactInfo, isLoading: isLoadingContactInfo, error: contactInfoError } = useQuery({
        queryKey: ["contact-info"],
        queryFn: () => settingsApi.contactInfo.getAll(true),
    });

    const { data: bankDetails = [], isLoading: isLoadingBankDetails } = useQuery({
        queryKey: ["bank-details"],
        queryFn: () => bankDetailsService.getAll(true),
    });

    return {
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
    };
}
