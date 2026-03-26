import { logger } from "@/lib/logger";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import axios from "axios";
import { PostalCodeResult } from "@/types";
import i18n from "@/i18n/config";

interface Country {
    country: string;
    iso2: string;
    phone_code?: string;
}

interface State {
    name: string;
    state_code: string;
}

interface LocationState {
    countries: Country[];
    states: Record<string, State[]>; // Cache states by country ISO2
    postalCodeCache: Record<string, PostalCodeResult | false>; // Cache validation results "postalCode" -> data or false
    isLoadingCountries: boolean;
    isLoadingStates: Record<string, boolean>; // Loading state per country
    isValidatingPostalCode: boolean;
    isValidatingPhone: boolean;
    error: string | null;
    isInitialized: boolean;

    initializeStore: () => Promise<void>;
    fetchCountries: () => Promise<void>;
    fetchStates: (countryIso2: string) => Promise<void>;
    validatePostalCode: (postalCode: string, countryIso2?: string) => Promise<PostalCodeResult | false>;
    validatePhone: (phone: string) => Promise<{ isValid: boolean; error?: string }>;
}

export const useLocationStore = create<LocationState>()(
    persist(
        (set, get) => ({
            countries: [],
            states: {},
            postalCodeCache: {},
            isLoadingCountries: false,
            isLoadingStates: {},
            isValidatingPostalCode: false,
            isValidatingPhone: false,
            error: null,
            isInitialized: false,

            initializeStore: async () => {
                if (get().isInitialized && get().countries.length > 0) {
                    logger.debug("Location Store: Already initialized");
                    return;
                }

                logger.debug("Location Store: Starting initialization from backend...");
                set({ isLoadingCountries: true, error: null });
                try {
                    const apiUrl = import.meta.env.VITE_API_URL;
                    const response = await axios.get(`${apiUrl}/geo/countries`);

                    if (response.data && Array.isArray(response.data)) {
                        set({
                            countries: response.data,
                            isInitialized: true
                        });
                        logger.debug(`Location Store: Loaded ${response.data.length} countries from backend.`);
                    } else {
                        throw new Error("Invalid response from backend countries API");
                    }
                } catch (err) {
                    logger.error('Location Store: Initialization failed', err);
                    set({ error: i18n.t("errors.location.loadFailed", { defaultValue: "We couldn't load location data right now." }) });
                } finally {
                    set({ isLoadingCountries: false });
                }
            },

            fetchCountries: async () => {
                // No-op if initialized, already handled by initializeStore
                if (get().isInitialized) return;
                await get().initializeStore();
            },

            fetchStates: async (countryIso2: string) => {
                if (get().states[countryIso2]?.length > 0) return;

                set((state) => ({
                    isLoadingStates: { ...state.isLoadingStates, [countryIso2]: true }
                }));

                try {
                    const apiUrl = import.meta.env.VITE_API_URL;
                    const response = await axios.get(`${apiUrl}/geo/states/${countryIso2}`);

                    if (response.data && Array.isArray(response.data)) {
                        set((state) => ({
                            states: { ...state.states, [countryIso2]: response.data }
                        }));
                    }
                } catch (err) {
                    logger.error(`Location Store: Failed to fetch states for ${countryIso2}`, err);
                } finally {
                    set((state) => ({
                        isLoadingStates: { ...state.isLoadingStates, [countryIso2]: false }
                    }));
                }
            },

            validatePostalCode: async (postalCode: string, countryIso2: string = 'IN') => {
                if (!postalCode) return false;

                const cacheKey = `${countryIso2}-${postalCode}`;
                const cachedResult = get().postalCodeCache[cacheKey];
                if (cachedResult !== undefined) return cachedResult;

                set({ isValidatingPostalCode: true });

                try {
                    // Use backend proxy instead of direct external call to avoid CORS/rate-limiting
                    const apiUrl = import.meta.env.VITE_API_URL;
                    const response = await axios.get(`${apiUrl}/geo/postal/${countryIso2}/${postalCode}`);

                    if (response.data && response.data.valid) {
                        const rawData = response.data.data;
                        let result: PostalCodeResult;

                        // Normalize based on which API the backend used
                        if (countryIso2 === 'IN' && Array.isArray(rawData)) {
                            // India Post Pincode API structure (already handled in legacy code mostly)
                            const postOffice = rawData[0].PostOffice[0];
                            result = {
                                isValid: true,
                                city: postOffice.District,
                                state: postOffice.State,
                                country: postOffice.Country,
                                locality: postOffice.Name
                            };
                        } else if (rawData.places && rawData.places.length > 0) {
                            // Zippopotam structure
                            const place = rawData.places[0];
                            result = {
                                isValid: true,
                                city: place['place name'],
                                state: place.state,
                                country: countryIso2 === 'IN' ? 'India' : rawData.country,
                                locality: place['place name']
                            };
                        } else if (rawData.postalcodes && rawData.postalcodes.length > 0) {
                            // GeoNames structure
                            const place = rawData.postalcodes[0];
                            result = {
                                isValid: true,
                                city: place.adminName2 || place.placeName,
                                state: place.adminName1,
                                country: countryIso2 === 'IN' ? 'India' : place.countryCode,
                                locality: place.placeName
                            };
                        } else {
                            throw new Error("Unknown data structure from geo service");
                        }

                        set((state) => ({
                            postalCodeCache: { ...state.postalCodeCache, [cacheKey]: result }
                        }));
                        return result;
                    } else {
                        set((state) => ({
                            postalCodeCache: { ...state.postalCodeCache, [cacheKey]: false }
                        }));
                        return false;
                    }

                } catch (error) {
                    logger.error("Postal validation failed", error);
                    return false;
                } finally {
                    set({ isValidatingPostalCode: false });
                }
            },

            validatePhone: async (phone: string) => {
                if (!phone) {
                    return {
                        isValid: false,
                        error: i18n.t("validation.phone.required", { defaultValue: "Phone number is required" })
                    };
                }

                set({ isValidatingPhone: true });
                try {
                    const apiUrl = import.meta.env.VITE_API_URL;
                    const response = await axios.get(`${apiUrl}/geo/validate-phone`, {
                        params: { phone }
                    });

                    return response.data;
                } catch (error: any) {
                    logger.error("Phone validation failed", error);
                    if (error.response?.status === 429) {
                        return { isValid: true, error: error.response.data.message };
                    }
                    return { isValid: true }; // Fallback to avoid blocking
                } finally {
                    set({ isValidatingPhone: false });
                }
            }
        }),
        {
            name: 'location-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                countries: state.countries,
                states: state.states,
                isInitialized: state.isInitialized,
                postalCodeCache: state.postalCodeCache
            })
        }
    )
);
