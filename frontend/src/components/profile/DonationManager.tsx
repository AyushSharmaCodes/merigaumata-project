import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { donationService } from "@/services/donation.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Heart } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { getErrorMessage } from "@/lib/errorUtils";
import { useTranslation } from "react-i18next";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Subscription {
    id: string;
    donation_reference_id: string;
    amount: number;
    status: 'active' | 'created' | 'authenticated' | 'paused' | 'cancelled';
    next_billing_at: string | null;
    razorpay_subscription_id: string;
}

export default function DonationManager() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [selectedSubId, setSelectedSubId] = useState<string | null>(null);

    // Fetch subscriptions
    const { data: subscriptionsData, isLoading } = useQuery({
        queryKey: ["mySubscriptions"],
        queryFn: donationService.getSubscriptions,
    });

    const subscriptions = subscriptionsData?.subscriptions || [];

    // Cancel Mutation
    const cancelMutation = useMutation({
        mutationFn: donationService.cancelSubscription,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["mySubscriptions"] });
            toast({
                title: t("profile.recurringDonations.cancelled"),
                description: t("profile.recurringDonations.cancelledDesc"),
            });
            setSelectedSubId(null);
        },
        onError: (error: unknown) => {
            toast({
                title: t("profile.recurringDonations.cancelFailed"),
                description: getErrorMessage(error, t, "profile.recurringDonations.cancelFailedDesc"),
                variant: "destructive",
            });
            setSelectedSubId(null);
        },
    });

    const pauseMutation = useMutation({
        mutationFn: donationService.pauseSubscription,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["mySubscriptions"] });
            toast({
                title: t("profile.recurringDonations.paused"),
                description: t("profile.recurringDonations.pausedDesc"),
            });
        },
        onError: (error: unknown) => {
            toast({
                title: t("profile.recurringDonations.pauseFailed"),
                description: getErrorMessage(error, t, "profile.recurringDonations.pauseFailedDesc"),
                variant: "destructive",
            });
        },
    });

    const resumeMutation = useMutation({
        mutationFn: donationService.resumeSubscription,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["mySubscriptions"] });
            toast({
                title: t("profile.recurringDonations.resumed"),
                description: t("profile.recurringDonations.resumedDesc"),
            });
        },
        onError: (error: unknown) => {
            toast({
                title: t("profile.recurringDonations.resumeFailed"),
                description: getErrorMessage(error, t, "profile.recurringDonations.resumeFailedDesc"),
                variant: "destructive",
            });
        },
    });

    const handleCancelClick = (subId: string) => {
        setSelectedSubId(subId);
    };

    const confirmCancel = () => {
        if (selectedSubId) {
            cancelMutation.mutate(selectedSubId);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // If no recurring donations found
    if (subscriptions.length === 0) {
        return (
            <Card className="rounded-[2.5rem] border border-border shadow-soft overflow-hidden bg-card text-card-foreground">
                <CardHeader className="bg-muted/30 pb-4 border-b border-border/50">
                    <div className="flex items-center gap-2">
                        <Heart className="h-5 w-5 text-primary" />
                        <CardTitle className="font-playfair">{t("profile.recurringDonations.title")}</CardTitle>
                    </div>
                    <CardDescription className="text-muted-foreground">
                        {t("profile.recurringDonations.noActive")}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-12 bg-muted/20 rounded-[2rem] border-2 border-dashed border-border mt-4">
                        <Heart className="mx-auto h-12 w-12 mb-4 text-muted/20" />
                        <p className="text-muted-foreground italic text-sm">{t("profile.recurringDonations.considerStarting")}</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card className="rounded-[2.5rem] border border-border shadow-soft overflow-hidden bg-card text-card-foreground">
                <CardHeader className="bg-muted/30 pb-4 border-b border-border/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 rounded-2xl shadow-sm">
                            <Heart className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-xl font-playfair">{t("profile.recurringDonations.title")}</CardTitle>
                            <CardDescription className="text-muted-foreground">
                                {t("profile.recurringDonations.manageDesc")}
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-4 px-6 md:px-8">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-border">
                                    <TableHead className="text-muted-foreground uppercase text-[10px] tracking-widest font-bold">{t("profile.recurringDonations.refId")}</TableHead>
                                    <TableHead className="text-muted-foreground uppercase text-[10px] tracking-widest font-bold">{t("profile.recurringDonations.amount")}</TableHead>
                                    <TableHead className="text-muted-foreground uppercase text-[10px] tracking-widest font-bold">{t("profile.recurringDonations.status")}</TableHead>
                                    <TableHead className="text-muted-foreground uppercase text-[10px] tracking-widest font-bold">{t("profile.recurringDonations.nextBilling")}</TableHead>
                                    <TableHead className="text-right text-muted-foreground uppercase text-[10px] tracking-widest font-bold">{t("profile.recurringDonations.actions")}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {subscriptions.map((sub: Subscription) => (
                                    <TableRow key={sub.id} className="hover:bg-muted/30 border-border transition-colors">
                                        <TableCell className="font-medium font-mono text-[11px] text-muted-foreground/80">
                                            {sub.donation_reference_id}
                                        </TableCell>
                                        <TableCell className="font-bold">₹{sub.amount}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border-none shadow-sm ${sub.status === 'active' ? 'bg-green-500/10 text-green-600' :
                                                sub.status === 'paused' ? 'bg-yellow-500/10 text-yellow-600' :
                                                    'bg-muted text-muted-foreground'
                                                }`}>
                                                {sub.status.toUpperCase()}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-xs">
                                            {sub.next_billing_at
                                                ? format(new Date(sub.next_billing_at), 'PP')
                                                : (sub.status === 'created' ? t("profile.recurringDonations.pendingFirst") : t("profile.recurringDonations.na"))}
                                        </TableCell>
                                        <TableCell className="text-right space-x-2">
                                            {sub.status === 'paused' && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 rounded-full border-border text-muted-foreground hover:bg-muted hover:text-foreground text-[10px] font-bold uppercase tracking-widest"
                                                    onClick={() => resumeMutation.mutate(sub.razorpay_subscription_id)}
                                                    disabled={resumeMutation.isPending}
                                                >
                                                    {t("profile.recurringDonations.resume")}
                                                </Button>
                                            )}

                                            {(sub.status === 'active' || sub.status === 'authenticated') && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 rounded-full border-border text-muted-foreground hover:bg-muted hover:text-foreground text-[10px] font-bold uppercase tracking-widest"
                                                    onClick={() => pauseMutation.mutate(sub.razorpay_subscription_id)}
                                                    disabled={pauseMutation.isPending}
                                                >
                                                    {t("profile.recurringDonations.pause")}
                                                </Button>
                                            )}

                                            {(sub.status === 'active' || sub.status === 'created' || sub.status === 'authenticated' || sub.status === 'paused') && (
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    className="h-8 rounded-full bg-destructive/10 hover:bg-destructive text-destructive hover:text-destructive-foreground border border-destructive/20 text-[10px] font-bold uppercase tracking-widest transition-all"
                                                    onClick={() => handleCancelClick(sub.razorpay_subscription_id)}
                                                    disabled={cancelMutation.isPending}
                                                >
                                                    {t("profile.recurringDonations.cancel")}
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <AlertDialog open={!!selectedSubId} onOpenChange={(open) => !open && setSelectedSubId(null)}>
                <AlertDialogContent className="rounded-[2.5rem] border border-border shadow-elevated p-8 max-w-md bg-card text-card-foreground">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-2xl font-playfair text-foreground">{t("profile.recurringDonations.stopTitle")}</AlertDialogTitle>
                        <AlertDialogDescription className="text-base pt-2 text-muted-foreground">
                            {t("profile.recurringDonations.stopDesc")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="pt-8 gap-3">
                        <AlertDialogCancel className="rounded-full px-8 bg-muted border-border text-foreground hover:bg-muted/80">{t("profile.recurringDonations.keepActive")}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmCancel}
                            className="bg-red-600 text-white hover:bg-red-700 rounded-full px-8 shadow-lg shadow-red-600/20 font-bold"
                        >
                            {cancelMutation.isPending ? t("profile.recurringDonations.cancelling") : t("profile.recurringDonations.confirmStop")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
