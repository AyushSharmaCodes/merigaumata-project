import { useEventRegistration, RegistrationForm, EventImageCard, RegistrationConfirmDialog, RegistrationStatusDialog } from "@/features/events";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { XCircle } from "lucide-react";
import { EventDetailSkeleton } from "@/shared/components/ui/page-skeletons";

export const EventRegistrationPage = () => {
    const {
        t, event, isLoading, navigate,
        formData, setFormData,
        agreedToTerms, setAgreedToTerms,
        showConfirmDialog, setShowConfirmDialog,
        errors,
        isCheckingEligibility,
        isProcessing,
        statusDialog, setStatusDialog,
        handleInputChange,
        handleSubmit,
        handleConfirmRegistration,
    } = useEventRegistration();

    if (isLoading) return <EventDetailSkeleton />;

    if (!event) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-4">{t("events.registration.notFound")}</h2>
                    <Button onClick={() => navigate("/events")}>{t("events.registration.backToEvents")}</Button>
                </div>
            </div>
        );
    }

    const isRegistrationClosed = event.isRegistrationEnabled === false || event.status === "cancelled" || event.status === "completed";
    if (isRegistrationClosed) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center space-y-4 max-w-md px-4">
                    <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto"><XCircle className="h-8 w-8 text-amber-600" /></div>
                    <h2 className="text-2xl font-bold">{t("events.registration.closed")}</h2>
                    <p className="text-muted-foreground text-sm">{t("events.registration.closedDesc")}</p>
                    <Button onClick={() => navigate(`/event/${event.id}`)}>{t("events.registration.backToEvent")}</Button>
                </div>
            </div>
        );
    }

    const isEventFull = event.capacity != null && event.capacity > 0 && (event.registrations || 0) >= event.capacity;
    if (isEventFull) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center space-y-4 max-w-md px-4">
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto"><XCircle className="h-8 w-8 text-red-500" /></div>
                    <h2 className="text-2xl font-bold">{t("events.registration.eventFull")}</h2>
                    <p className="text-muted-foreground text-sm">{t("events.registration.eventFullDesc")}</p>
                    <Button onClick={() => navigate(`/event/${event.id}`)}>{t("events.registration.backToEvent")}</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background py-8">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
                <div className="text-center mb-6">
                    <h1 className="text-3xl font-bold mb-2">{t("events.registration.title")}</h1>
                    <div className="w-20 h-1 bg-primary mx-auto"></div>
                </div>

                <Card className="overflow-hidden border-2">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                        <RegistrationForm
                            formData={formData}
                            onInputChange={handleInputChange}
                            onPhoneChange={(val) => setFormData(prev => ({ ...prev, phone: val }))}
                            agreedToTerms={agreedToTerms}
                            onAgreedChange={setAgreedToTerms}
                            onSubmit={handleSubmit}
                            errors={errors}
                            isChecking={isCheckingEligibility}
                            eventData={event}
                        />
                        <EventImageCard image={event.image} title={event.title} />
                    </div>
                </Card>
            </div>

            <RegistrationConfirmDialog
                open={showConfirmDialog}
                onOpenChange={setShowConfirmDialog}
                formData={formData}
                eventData={event}
                isProcessing={isProcessing}
                onConfirm={handleConfirmRegistration}
            />

            <RegistrationStatusDialog
                statusDialog={statusDialog}
                onOpenChange={(open) => {
                    setStatusDialog(prev => ({ ...prev, open }));
                    if (!open && statusDialog.onClose) statusDialog.onClose();
                }}
            />
        </div>
    );
};

