import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addressService } from "../services/address.service";
import { profileService, type UpdateProfileData } from "../api/profile.api";

export const userQueryKeys = {
  profile: (language?: string) => ["profile", language ?? "default"] as const,
  addresses: ["user-addresses"] as const,
};

export function useProfileQuery(language?: string, enabled = true) {
  return useQuery({
    queryKey: userQueryKeys.profile(language),
    queryFn: () => profileService.getProfile(language),
    enabled,
  });
}

export function useAddressesQuery(enabled = true) {
  return useQuery({
    queryKey: userQueryKeys.addresses,
    queryFn: () => addressService.getAddresses(),
    enabled,
  });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProfileData) => profileService.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export function useUpdatePreferencesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: profileService.updatePreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}
