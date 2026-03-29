import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import { profileService } from "@/services/profile.service";
import { localizeAllCachedQueries } from "@/utils/localizeCachedData";
import { logger } from "@/lib/logger";

export const useLanguage = () => {
    const { i18n, t } = useTranslation();
    const queryClient = useQueryClient();
    const { isAuthenticated, isInitialized, updateUser } = useAuthStore();
    const { fetchCart } = useCartStore();

    const changeLanguage = async (lng: string) => {
        try {
            logger.debug(`Changing language to: ${lng}`);

            // 1. Update localStorage synchronously so API interceptors pick it up immediately
            localStorage.setItem("language", lng);

            // 2. Change i18next language (this is async and triggers re-renders in useTranslation hooks)
            await i18n.changeLanguage(lng);

            if (isAuthenticated && isInitialized) {
                try {
                    await profileService.updatePreferences({ language: lng });
                    updateUser({ language: lng });
                } catch (preferenceError) {
                    logger.warn("Failed to persist language preference", { preferenceError, language: lng });
                }
            }

            // 3. Update existing cache manually for immediate (though partial) UI update
            localizeAllCachedQueries(queryClient, lng);

            // 4. Trigger a background refetch of all active queries to get fresh, server-side translated data
            // Passing { type: 'active' } ensures we only refetch what's currently being viewed
            await queryClient.refetchQueries({
                type: "active",
            });

            // 5. Special handling for Cart (often contains complex calculated/translated data)
            try {
                await fetchCart(true);
            } catch (cartError) {
                logger.warn("Cart refresh after language change failed", { cartError, language: lng });
            }

            // 6. Special handling for User Profile (User name, etc.)
            if (isAuthenticated && isInitialized) {
                try {
                    const profile = await profileService.getProfile(lng);
                    if (profile && profile.name) {
                        updateUser({
                            name: profile.name,
                            phone: profile.phone
                        });
                    }
                } catch (profileError) {
                    logger.error("Failed to fetch translated profile after language change", { profileError, language: lng });
                }
            }

            logger.info(`Successfully changed language to: ${lng}`);
        } catch (error) {
            logger.error("Critical error during language change", { error, targetLanguage: lng });
        }
    };

    return {
        changeLanguage,
        currentLanguage: i18n.language,
        t,
        i18n
    };
};
