import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { profileService, ProfileData, UpdateProfileData } from "@/services/profile.service";
import { donationService } from "@/services/donation.service";
import { eventRegistrationService, EventRegistration } from "@/services/event-registration.service";
import { addressService } from "@/services/address.service";
import { CreateAddressDto } from "@/types";
import { getErrorMessage } from "@/lib/errorUtils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProfileHeader from "@/components/profile/ProfileHeader";
import PersonalInfoForm from "@/components/profile/PersonalInfoForm";
import AddressManager from "@/components/profile/AddressManager";
import DeleteAccountSection from "@/components/profile/DeleteAccountSection";
import DonationManager from "@/components/profile/DonationManager";
import { UpdatePasswordDialog } from "@/components/profile/UpdatePasswordDialog";
import { EventCancellationDialog } from "@/components/admin/EventCancellationDialog";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useAuthStore } from "@/store/authStore";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Loader2, Heart, Calendar, ExternalLink, User, Sparkles, UserCircle } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/ui/loading-overlay";

import { useTranslation } from "react-i18next";
import { hi } from "date-fns/locale";
import { ProfileMessages } from "@/constants/messages/ProfileMessages";
import { CommonMessages } from "@/constants/messages/CommonMessages";

export default function Profile() {
  const { t, i18n } = useTranslation();
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

  const { data: profile, isLoading, isFetching } = useQuery<ProfileData>({
    queryKey: ["profile", isAuthenticated, i18n.language], // Refetch when language changes
    queryFn: () => profileService.getProfile(i18n.language), // Pass language to service
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Fetch event registrations
  const { data: registrationsData, isLoading: registrationsLoading } = useQuery({
    queryKey: ["myEventRegistrations", page],
    queryFn: () => eventRegistrationService.getMyRegistrations({ page, limit: LIMIT }),
    enabled: !!user,
  });

  const eventRegistrations = registrationsData?.registrations || [];
  const totalRegistrations = registrationsData?.total || 0;

  // Fetch subscriptions for visibility check
  const { data: subscriptionsData } = useQuery({
    queryKey: ["mySubscriptions"],
    queryFn: donationService.getSubscriptions,
    enabled: !!user,
  });
  const hasSubscriptions = (subscriptionsData?.subscriptions?.length ?? 0) > 0;

  // Cancel registration mutation
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

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: (data: UpdateProfileData) => profileService.updateProfile(data),
    onMutate: async (newProfileData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["profile", isAuthenticated, i18n.language] });

      // Snapshot the previous value
      const previousProfile = queryClient.getQueryData<ProfileData>(["profile", isAuthenticated, i18n.language]);

      // Optimistically update to the new value in the query cache
      if (previousProfile) {
        queryClient.setQueryData(["profile", isAuthenticated, i18n.language], {
          ...previousProfile,
          ...newProfileData,
          name: `${newProfileData.firstName} ${newProfileData.lastName || ''}`.trim()
        });
      }

      // Also optimistically update the global auth store for Navbar consistency
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
      // Rollback to the previous value if mutation fails
      if (context?.previousProfile) {
        queryClient.setQueryData(["profile", isAuthenticated, i18n.language], context.previousProfile);

        // Also rollback auth store
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
      // Always refetch after error or success to ensure we are in sync with server
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  // Avatar upload mutation
  const uploadAvatarMutation = useMutation({
    mutationFn: (file: File) => profileService.uploadAvatar(file),
    onSuccess: () => {
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

  // Delete avatar mutation
  const deleteAvatarMutation = useMutation({
    mutationFn: profileService.deleteAvatar,
    onSuccess: () => {
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

  // Address mutations
  const addAddressMutation = useMutation({
    mutationFn: addressService.createAddress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
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



  if (isLoading) {
    return <LoadingOverlay isLoading={true} message={t(ProfileMessages.LOADING_PROFILE)} />;
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>{t(ProfileMessages.PROFILE_NOT_FOUND)}</p>
      </div>
    );
  }

  // Helper functions for mutations to match the new structure's expectations
  const handleAvatarUpdate = (file: File) => uploadAvatarMutation.mutate(file);
  const handleAvatarDelete = () => deleteAvatarMutation.mutate();
  const handleUpdateProfile = async (data: UpdateProfileData) => {
    await updateProfileMutation.mutateAsync(data);
  };
  const setShowPasswordDialog = (open: boolean) => setPasswordDialogOpen(open);

  const isActionLoading =
    addAddressMutation.isPending ||
    updateAddressMutation.isPending ||
    deleteAddressMutation.isPending ||
    setPrimaryMutation.isPending ||
    updateProfileMutation.isPending ||
    uploadAvatarMutation.isPending ||
    deleteAvatarMutation.isPending;

  const actionMessage =
    addAddressMutation.isPending ? t(ProfileMessages.ADDING_NEW_ADDRESS) :
      updateAddressMutation.isPending ? t(ProfileMessages.UPDATING_ADDRESS) :
        deleteAddressMutation.isPending ? t(ProfileMessages.REMOVING_ADDRESS) :
          setPrimaryMutation.isPending ? t(ProfileMessages.SETTING_PRIMARY_ADDRESS) :
            updateProfileMutation.isPending ? t(ProfileMessages.SAVING) :
              uploadAvatarMutation.isPending ? t(ProfileMessages.UPDATING_PROFILE_PICTURE) :
                deleteAvatarMutation.isPending ? t(ProfileMessages.REMOVING_PROFILE_PICTURE) :
                  t(CommonMessages.JUST_A_MOMENT);

  // Use fetching state for background updates, but only show loader on first load or manual actions
  const showInitialLoading = isLoading && !profile;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LoadingOverlay
        isLoading={showInitialLoading || isActionLoading}
        message={showInitialLoading ? t(ProfileMessages.LOADING_PROFILE) : actionMessage}
      />

      {/* Modern Profile Hero Section */}
      <section className="pt-16 pb-4">
        <div className="container mx-auto px-4">
          <div className="group transition-all duration-300 hover:-translate-y-1 hover:shadow-elevated rounded-[2.5rem] bg-primary/5 p-8 border border-primary/10 mx-2">
            <div className="space-y-2">
              <h1 className="text-5xl font-bold font-playfair tracking-tight text-foreground lowercase first-letter:uppercase">
                Profile
              </h1>
              <p className="text-primary text-sm font-medium">
                View all your profile details here.
              </p>
            </div>
          </div>
          <div className="mt-12 border-t border-dashed border-border w-full"></div>
        </div>
      </section>

      <div className="container mx-auto px-4 pb-12">
        <div className="space-y-8">
          {/* Main Profile Info Grid */}
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Left Column: Avatar & Name */}
              <div className="lg:col-span-4">
                {(() => {
                  const isDefaultName = profile.firstName === 'common.user.defaultName' || profile.firstName === 'AuthMessages.DEFAULT_USER_NAME';
                  const displayName = isDefaultName ? t('common.user.defaultName') : profile.firstName;

                  return (
                    <ProfileHeader
                      name={`${displayName} ${profile.lastName || ""}`}
                      email={profile.email}
                      phone={profile.phone}
                      avatarUrl={profile.avatarUrl}
                      isEmailVerified={profile.emailVerified}
                      onAvatarUpdate={handleAvatarUpdate}
                      onAvatarDelete={handleAvatarDelete}
                    />
                  );
                })()}
              </div>

              {/* Right Column: Bio & Other Details */}
              <div className="lg:col-span-8">
                {(() => {
                  const isDefaultName = profile.firstName === 'common.user.defaultName' || profile.firstName === 'AuthMessages.DEFAULT_USER_NAME';
                  const formName = isDefaultName ? "" : profile.firstName;

                  return (
                    <PersonalInfoForm
                      initialData={{
                        firstName: formName || "",
                        lastName: profile.lastName || "",
                        gender: profile.gender,
                        email: profile.email,
                        phone: profile.phone,
                      }}
                      onSave={handleUpdateProfile}
                      onChangePassword={() => setPasswordDialogOpen(true)}
                      loading={updateProfileMutation.isPending}
                    />
                  );
                })()}
              </div>
            </div>
          </section>

          {/* Additional Sections (Tabs) */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex justify-start mb-8 overflow-x-auto pb-2">
              <TabsList className="h-12 rounded-full bg-muted p-1 border border-border">
                <TabsTrigger value="account" className="rounded-full px-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all font-bold text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
                  {t(ProfileMessages.ACCOUNT_SETTINGS)}
                </TabsTrigger>
                <TabsTrigger value="events" className="rounded-full px-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all font-bold text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
                  {t(ProfileMessages.EVENTS)}
                </TabsTrigger>
                {hasSubscriptions && (
                  <TabsTrigger value="donations" className="rounded-full px-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all font-bold text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
                    {t(ProfileMessages.MY_DONATIONS)}
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            <TabsContent value="account" className="animate-in fade-in-0 zoom-in-95 duration-300">
              <AddressManager
                addresses={profile.addresses}
                onAdd={async (data) => {
                  await addAddressMutation.mutateAsync(data);
                }}
                onUpdate={async (id, data) => {
                  await updateAddressMutation.mutateAsync({ id, data });
                }}
                onDelete={async (id) => {
                  await deleteAddressMutation.mutateAsync(id);
                }}
                onSetPrimary={async (id) => {
                  const addr = profile.addresses.find(a => a.id === id);
                  if (addr) {
                    const type = (addr.type === 'home' || addr.type === 'work' || addr.type === 'other')
                      ? addr.type as 'home' | 'work' | 'other'
                      : 'other';
                    await setPrimaryMutation.mutateAsync({ id, type });
                  }
                }}
              />
            </TabsContent>

            <TabsContent value="events" className="animate-in fade-in-0 zoom-in-95 duration-300">
              <Card className="shadow-soft border border-border rounded-[2.5rem] overflow-hidden bg-card text-card-foreground">
                <CardHeader className="bg-muted/30 pb-6 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 rounded-2xl shadow-sm">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-playfair">{t(ProfileMessages.EVENT_REGISTRATIONS)}</CardTitle>
                      <CardDescription className="text-muted-foreground">{t(ProfileMessages.EVENT_REGISTRATIONS_DESC)}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  {registrationsLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-[#B85C3C]" />
                    </div>
                  ) : eventRegistrations.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {eventRegistrations.map((reg: EventRegistration) => {
                        // Compute cancellation eligibility
                        const eventStartDate = reg.events?.start_date ? new Date(reg.events.start_date) : null;
                        if (eventStartDate && reg.events?.start_time) {
                          const [h, m] = reg.events.start_time.split(':').map(Number);
                          if (!isNaN(h) && !isNaN(m)) eventStartDate.setHours(h, m, 0, 0);
                        }
                        const now = Date.now();
                        const twentyFourHoursMs = 24 * 60 * 60 * 1000;
                        const canCancel = reg.status === 'confirmed' && eventStartDate && (eventStartDate.getTime() - now > twentyFourHoursMs);
                        const isWithin24h = reg.status === 'confirmed' && eventStartDate && (eventStartDate.getTime() - now <= twentyFourHoursMs) && (eventStartDate.getTime() > now);

                        // Refund data from event_refunds join
                        const refundData = reg.event_refunds && reg.event_refunds.length > 0 ? reg.event_refunds[0] : (reg.refunds && reg.refunds.length > 0 ? reg.refunds[0] : null);

                        return (
                        <div
                          key={reg.id}
                          className="group flex flex-col sm:flex-row gap-4 p-5 border border-border rounded-3xl hover:bg-muted/30 hover:border-primary/30 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md"
                          onClick={() => navigate(`/event/${reg.event_id}`)}
                        >
                          {/* Event Image */}
                          <div className="w-full sm:w-28 h-28 bg-muted rounded-2xl overflow-hidden flex-shrink-0 shadow-inner">
                            {reg.events?.image ? (
                              <img
                                src={reg.events.image}
                                alt={reg.events.title}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-muted/50">
                                <Calendar className="h-10 w-10 text-muted-foreground/20" />
                              </div>
                            )}
                          </div>

                          {/* Event Details */}
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                                  {reg.events?.title || t(ProfileMessages.SACRED_GATHERING)}
                                </h3>
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                  <Calendar className="h-3 w-3" />
                                  {reg.events?.start_date
                                    ? format(new Date(reg.events.start_date), 'PPP', { locale: t(CommonMessages.LANG) === 'hi' ? hi : undefined })
                                    : t(ProfileMessages.DATE_TBD)}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              {reg.status === 'cancelled' ? (
                                <Badge variant="destructive" className="text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                                  {t(ProfileMessages.CANCELLED)}
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border-none shadow-sm ${reg.payment_status === 'paid' ? 'bg-green-500/10 text-green-400' :
                                    reg.payment_status === 'free' ? 'bg-blue-500/10 text-blue-400' : 'bg-orange-500/10 text-orange-400'
                                    }`}
                                >
                                  {reg.payment_status === 'paid'
                                    ? `₹${reg.amount} ${t(ProfileMessages.PAID)}`
                                    : reg.payment_status === 'free'
                                      ? t(ProfileMessages.COMPLIMENTARY)
                                      : t(ProfileMessages.PENDING)}
                                </Badge>
                              )}

                              {/* Refund status badge */}
                              {reg.status === 'cancelled' && refundData && (
                                <Badge variant="outline" className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm ${refundData.status === 'SETTLED' ? 'bg-green-500/10 text-green-400' :
                                  refundData.status === 'FAILED' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'
                                  }`}>
                                  {t(ProfileMessages.REFUND)}: {t(`profile.status.${refundData.status.toLowerCase()}`, refundData.status)}
                                </Badge>
                              )}

                              {/* Refund ID badge - show gateway_reference if available */}
                              {reg.status === 'cancelled' && reg.event_refunds && reg.event_refunds.length > 0 && reg.event_refunds[0].gateway_reference && (
                                <Badge variant="secondary" className="text-[10px] font-mono bg-muted text-muted-foreground border-none">
                                  {t(ProfileMessages.REFUND_ID)}: {reg.event_refunds[0].gateway_reference}
                                </Badge>
                              )}

                              <Badge variant="secondary" className="text-[10px] font-mono bg-muted text-muted-foreground border-none">
                                {t(ProfileMessages.REGISTRATION_NUMBER)}{reg.registration_number}
                              </Badge>
                            </div>

                            {/* 24-hour cancellation note */}
                            {reg.status === 'confirmed' && (
                              <div className={`flex items-center gap-1.5 text-[10px] font-medium mt-1 ${isWithin24h ? 'text-orange-400' : 'text-muted-foreground'}`}>
                                <Calendar className="h-3 w-3 flex-shrink-0" />
                                {isWithin24h
                                  ? t(ProfileMessages.CANCELLATION_WINDOW_PASSED)
                                  : t(ProfileMessages.CANCELLATION_WINDOW_NOTE)}
                              </div>
                            )}

                            <div className="flex items-center gap-3 pt-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-0 text-[11px] font-bold uppercase tracking-wider text-primary hover:bg-transparent hover:text-primary-hover"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/event/${reg.event_id}`);
                                }}
                              >
                                {t(ProfileMessages.DETAILS)}
                              </Button>

                              {/* Cancel Registration button */}
                              {canCancel && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-0 text-[11px] font-bold uppercase tracking-wider text-red-400 hover:bg-transparent hover:text-red-500"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedRegId(reg.id);
                                  }}
                                >
                                  {t(ProfileMessages.CANCEL_REGISTRATION)}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-20 bg-muted/20 rounded-[2rem] border-2 border-dashed border-border">
                      <div className="bg-primary/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <Calendar className="h-8 w-8 text-primary/30" />
                      </div>
                      <h3 className="text-foreground font-bold text-lg">{t(ProfileMessages.NO_REGISTRATIONS)}</h3>
                      <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-1 mb-6">
                        {t(ProfileMessages.NO_REGISTRATIONS_DESC)}
                      </p>
                      <Button
                        onClick={() => navigate('/events')}
                        className="rounded-full px-8 bg-primary text-primary-foreground hover:bg-primary-hover transition-all font-bold"
                      >
                        {t(ProfileMessages.EXPLORE_EVENTS)}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Pagination Controls */}
              {totalRegistrations > LIMIT && (
                <div className="flex items-center justify-between mt-6 px-2">
                  <div className="text-sm text-white/40">
                    {t(ProfileMessages.SHOWING)} {(page - 1) * LIMIT + 1} {t(ProfileMessages.TO)} {Math.min(page * LIMIT, totalRegistrations)} {t(ProfileMessages.OF)} {totalRegistrations} {t(ProfileMessages.EVENTS)}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="rounded-full bg-card border-border text-foreground hover:bg-muted"
                    >
                      {t(ProfileMessages.PREVIOUS)}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => p + 1)}
                      disabled={page * LIMIT >= totalRegistrations}
                      className="rounded-full bg-card border-border text-foreground hover:bg-muted"
                    >
                      {t(ProfileMessages.NEXT)}
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {hasSubscriptions && (
              <TabsContent value="donations" className="animate-in fade-in-0 zoom-in-95 duration-300">
                <DonationManager />
              </TabsContent>
            )}
          </Tabs>

          {/* Danger Zone: Moved to Bottom */}
          {user?.role !== 'admin' && (
            <section className="pt-8 border-t border-dashed border-border">
              <DeleteAccountSection
                onDelete={async () => navigate('/account/delete')}
              />
            </section>
          )}
        </div>
      </div>

      <UpdatePasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
      />

      <EventCancellationDialog
        isOpen={!!selectedRegId}
        onClose={() => setSelectedRegId(null)}
        onConfirm={confirmCancelRegistration}
        isUser={true}
        title={t(ProfileMessages.CANCEL_REG_TITLE)}
        description={t(ProfileMessages.CANCEL_REG_DESC)}
        warningText={t(ProfileMessages.CANCEL_REG_WARNING)}
        confirmLabel={t(ProfileMessages.CONFIRM_CANCELLATION)}
        isLoading={cancelRegistrationMutation.isPending}
      />
    </div>
  );
}
