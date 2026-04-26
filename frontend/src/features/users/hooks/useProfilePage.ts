import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/domains/auth";
import { useCurrency } from "@/app/providers/currency-provider";
import { toast } from "@/shared/hooks/use-toast";
import { getErrorMessage } from "@/core/utils/errorUtils";
import { profileService, type ProfileData, type UpdateProfileData } from "@/domains/user/api/profile.api";
import { addressService } from "@/domains/user/services/address.service";
import { eventRegistrationService } from "@/domains/content";
import { ProfileMessages } from "@/shared/constants/messages/ProfileMessages";
import { CommonMessages } from "@/shared/constants/messages/CommonMessages";
import { syncPrimaryAddress } from "../utils/addressUtils";
import type { CheckoutAddress, CreateAddressDto } from "@/shared/types";

export function useProfilePage() {
  const { t, i18n } = useTranslation();
  const { formatAmount } = useCurrency();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user, logout, updateUser, isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState("account");

  useEffect(() => {
    if (searchParams.get('tab')) {
      setActiveTab(searchParams.get('tab')!);
    }
  }, [searchParams]);

  const [selectedRegId, setSelectedRegId] = useState<string | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  const [page, setPage] = useState(1);
  const LIMIT = 5;
  const profileQueryKey = ["profile", isAuthenticated, i18n.language] as const;

  const { data: profile, isLoading, isFetching } = useQuery<ProfileData>({
    queryKey: profileQueryKey,
    queryFn: () => profileService.getProfile(i18n.language),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: registrationsData, isLoading: registrationsLoading } = useQuery({
    queryKey: ["myEventRegistrations", page],
    queryFn: () => eventRegistrationService.getMyRegistrations({ page, limit: LIMIT }),
    enabled: !!user,
  });

  const eventRegistrations = registrationsData?.registrations || [];
  const totalRegistrations = registrationsData?.total || 0;

  const cancelRegistrationMutation = useMutation({
    mutationFn: (vars: { registrationId: string; reason: string }) => eventRegistrationService.cancelRegistration(vars),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myEventRegistrations"] });
      toast({
        title: t(ProfileMessages.REGISTRATION_CANCELLED),
        description: t(ProfileMessages.REGISTRATION_CANCELLED_DESC),
      });
      setSelectedRegId(null);
    },
    onError: (error: unknown) => {
      toast({
        title: t(ProfileMessages.CANCELLATION_FAILED),
        description: getErrorMessage(error, t, ProfileMessages.CANCELLATION_FAILED_DESC),
        variant: "destructive",
      });
    },
  });

  const confirmCancelRegistration = async (reason: string): Promise<void> => {
    if (selectedRegId) {
      await cancelRegistrationMutation.mutateAsync({ registrationId: selectedRegId, reason });
    }
  };

  const updateProfileMutation = useMutation({
    mutationFn: (data: UpdateProfileData) => profileService.updateProfile(data),
    onMutate: async (newProfileData) => {
      await queryClient.cancelQueries({ queryKey: profileQueryKey });
      const previousProfile = queryClient.getQueryData<ProfileData>(profileQueryKey);

      if (previousProfile) {
        queryClient.setQueryData(profileQueryKey, {
          ...previousProfile,
          ...newProfileData,
          name: `${newProfileData.firstName} ${newProfileData.lastName || ''}`.trim()
        });
      }

      const newName = `${newProfileData.firstName} ${newProfileData.lastName || ''}`.trim();
      updateUser({
        name: newName,
        phone: newProfileData.phone,
      });

      return { previousProfile };
    },
    onSuccess: () => {
      toast({
        title: t(CommonMessages.SUCCESS),
        description: t(ProfileMessages.UPDATE_SUCCESS),
      });
    },
    onError: (error: unknown, __, context) => {
      if (context?.previousProfile) {
        queryClient.setQueryData(profileQueryKey, context.previousProfile);
        updateUser({
          name: context.previousProfile.name,
          phone: context.previousProfile.phone,
        });
      }

      toast({
        title: t(CommonMessages.ERROR as any),
        description: getErrorMessage(error, t, ProfileMessages.UPDATE_FAILED),
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: (file: File) => profileService.uploadAvatar(file),
    onSuccess: ({ avatarUrl }) => {
      updateUser({ image: avatarUrl });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({
        title: t(CommonMessages.SUCCESS),
        description: t(ProfileMessages.PROFILE_PICTURE_UPDATED),
      });
    },
    onError: (error: unknown) => {
      toast({
        title: t(CommonMessages.ERROR as any),
        description: getErrorMessage(error, t, ProfileMessages.FAILED_AVATAR_UPLOAD),
        variant: "destructive",
      });
    },
  });

  const deleteAvatarMutation = useMutation({
    mutationFn: profileService.deleteAvatar,
    onSuccess: () => {
      updateUser({ image: undefined });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({
        title: t(CommonMessages.SUCCESS),
        description: t(ProfileMessages.PROFILE_PICTURE_REMOVED),
      });
    },
    onError: (error: unknown) => {
      toast({
        title: t(CommonMessages.ERROR as any),
        description: getErrorMessage(error, t, ProfileMessages.FAILED_AVATAR_DELETE),
        variant: "destructive",
      });
    },
  });

  const addAddressMutation = useMutation({
    mutationFn: addressService.createAddress,
    onSuccess: (newAddress) => {
      queryClient.setQueryData<ProfileData>(profileQueryKey, (current) => current ? ({
        ...current,
        addresses: [newAddress, ...current.addresses.filter((address) => address.id !== newAddress.id)]
      }) : current);
      queryClient.setQueryData(["addresses"], (current: CheckoutAddress[] | undefined) =>
        Array.isArray(current) 
          ? (newAddress.is_primary ? syncPrimaryAddress([newAddress, ...current], newAddress.id) : [newAddress, ...current])
          : [newAddress]
      );
      toast({
        title: t(CommonMessages.SUCCESS),
        description: t(ProfileMessages.ADDRESS_ADDED),
      });
    },
    onError: (error: unknown) => {
      toast({
        title: t(CommonMessages.ERROR as any),
        description: getErrorMessage(error, t, ProfileMessages.FAILED_ADDRESS_ADD),
        variant: "destructive",
      });
    },
  });

  const updateAddressMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateAddressDto }) =>
      addressService.updateAddress(id, data),
    onSuccess: (updatedAddress) => {
      queryClient.setQueryData<ProfileData>(profileQueryKey, (current) => current ? ({
        ...current,
        addresses: current.addresses.map((address) => address.id === updatedAddress.id ? updatedAddress : address)
      }) : current);
      queryClient.setQueryData(["addresses"], (current: CheckoutAddress[] | undefined) =>
        Array.isArray(current) 
          ? (updatedAddress.is_primary 
              ? syncPrimaryAddress(current.map(a => a.id === updatedAddress.id ? updatedAddress : a), updatedAddress.id)
              : current.map(a => a.id === updatedAddress.id ? updatedAddress : a))
          : [updatedAddress]
      );
      toast({
        title: t(CommonMessages.SUCCESS),
        description: t(ProfileMessages.ADDRESS_UPDATED),
      });
    },
    onError: (error: unknown) => {
      toast({
        title: t(CommonMessages.ERROR as any),
        description: getErrorMessage(error, t, ProfileMessages.FAILED_ADDRESS_UPDATE),
        variant: "destructive",
      });
    },
  });

  const deleteAddressMutation = useMutation({
    mutationFn: addressService.deleteAddress,
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData<ProfileData>(profileQueryKey, (current) => current ? ({
        ...current,
        addresses: current.addresses.filter((address) => address.id !== deletedId)
      }) : current);
      queryClient.setQueryData(["addresses"], (current: any[] | undefined) =>
        Array.isArray(current) ? current.filter((address) => address.id !== deletedId) : current
      );
      toast({
        title: t(CommonMessages.SUCCESS),
        description: t(ProfileMessages.ADDRESS_DELETED),
      });
    },
    onError: (error: unknown) => {
      toast({
        title: t(CommonMessages.ERROR as any),
        description: getErrorMessage(error, t, ProfileMessages.FAILED_ADDRESS_DELETE),
        variant: "destructive",
      });
    },
  });

  const setPrimaryMutation = useMutation({
    mutationFn: ({ id, type }: { id: string; type: 'home' | 'work' | 'other' }) =>
      addressService.setPrimary(id, type),
    onSuccess: (primaryAddress) => {
      queryClient.setQueryData<ProfileData>(profileQueryKey, (current) => current ? ({
        ...current,
        addresses: syncPrimaryAddress(current.addresses, primaryAddress.id)
      }) : current);
      queryClient.setQueryData(["addresses"], (current: any[] | undefined) =>
        Array.isArray(current) ? syncPrimaryAddress(current, primaryAddress.id) : [primaryAddress]
      );
      toast({
        title: t(CommonMessages.SUCCESS),
        description: t(ProfileMessages.PRIMARY_ADDRESS_UPDATED),
      });
    },
    onError: (error: unknown) => {
      toast({
        title: t(CommonMessages.ERROR as any),
        description: getErrorMessage(error, t, ProfileMessages.FAILED_PRIMARY_ADDRESS),
        variant: "destructive",
      });
    },
  });

  const handleAvatarUpdate = (file: File) => uploadAvatarMutation.mutate(file);
  const handleAvatarDelete = () => deleteAvatarMutation.mutate();
  const handleUpdateProfile = async (data: UpdateProfileData) => {
    await updateProfileMutation.mutateAsync(data);
  };

  return {
    t,
    i18n,
    formatAmount,
    navigate,
    user,
    profile,
    isLoading,
    isFetching,
    activeTab,
    setActiveTab,
    selectedRegId,
    setSelectedRegId,
    passwordDialogOpen,
    setPasswordDialogOpen,
    page,
    setPage,
    registrationsLoading,
    eventRegistrations,
    totalRegistrations,
    confirmCancelRegistration,
    cancelRegistrationMutation,
    updateProfileMutation,
    addAddressMutation,
    updateAddressMutation,
    deleteAddressMutation,
    setPrimaryMutation,
    handleAvatarUpdate,
    handleAvatarDelete,
    handleUpdateProfile,
    queryClient,
    LIMIT,
  };
}
