import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import ProfileHeader from "../components/profile/ProfileHeader";
import PersonalInfoForm from "../components/profile/PersonalInfoForm";
import AddressManager from "../components/profile/AddressManager";
import DeleteAccountSection from "../components/profile/DeleteAccountSection";
import DonationManager from "../components/profile/DonationManager";
import { DonationHistory } from "../components/profile/DonationHistory";
import { UpdatePasswordDialog } from "../components/profile/UpdatePasswordDialog";
import { EventCancellationDialog } from "@/features/admin/events";
import { ProfileSkeleton } from "@/shared/components/ui/page-skeletons";
import { ProfileMessages } from "@/shared/constants/messages/ProfileMessages";
import { useProfilePage } from "../hooks/useProfilePage";
import { profileService } from "@/domains/user/api/profile.api";

// Sub-components
import { ProfileHero } from "../components/profile/ProfileHero";
import { EventRegistrationsTab } from "../components/profile/EventRegistrationsTab";

export function ProfilePage() {

  const controller = useProfilePage();
  const {
    t,
    formatAmount,
    navigate,
    user,
    profile,
    isLoading,
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
  } = controller;

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>{t(ProfileMessages.PROFILE_NOT_FOUND)}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ProfileHero />

      <div className="container mx-auto px-4 pt-5 sm:pt-0 pb-12">
        <div className="space-y-6 sm:space-y-8">
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch">
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

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex justify-start mb-6 sm:mb-8 overflow-x-auto pb-2">
              <TabsList className="h-auto min-w-max rounded-full bg-muted p-1 border border-border">
                <TabsTrigger value="account" className="rounded-full px-4 sm:px-8 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all font-bold text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
                  {t(ProfileMessages.ACCOUNT_SETTINGS)}
                </TabsTrigger>
                <TabsTrigger value="events" className="rounded-full px-4 sm:px-8 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all font-bold text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
                  {t(ProfileMessages.EVENTS)}
                </TabsTrigger>
                <TabsTrigger value="donations" className="rounded-full px-4 sm:px-8 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all font-bold text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
                  {t(ProfileMessages.MY_DONATIONS)}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="account" className="animate-in fade-in-0 zoom-in-95 duration-300">
              <AddressManager
                addresses={profile.addresses}
                profilePhone={profile.phone || undefined}
                onProfilePhoneUpdate={async (phone) => {
                  try {
                    await profileService.updateProfile({
                      firstName: profile.firstName,
                      lastName: profile.lastName || undefined,
                      gender: profile.gender,
                      phone,
                    });
                    queryClient.invalidateQueries({ queryKey: ['profile'] });
                  } catch {
                  }
                }}
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
              <EventRegistrationsTab
                isLoading={registrationsLoading}
                registrations={eventRegistrations}
                totalRegistrations={totalRegistrations}
                page={page}
                limit={LIMIT}
                onPageChange={setPage}
                onNavigateToEvent={(id) => id ? navigate(`/event/${id}`) : navigate('/events')}
                onCancelRegistration={setSelectedRegId}
                formatAmount={formatAmount}
              />
            </TabsContent>

            <TabsContent value="donations" className="animate-in fade-in-0 zoom-in-95 duration-300 space-y-6">
              <DonationHistory />
              <DonationManager />
            </TabsContent>
          </Tabs>

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
