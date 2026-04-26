import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { useTranslation } from "react-i18next";
import { ProfileMessages } from "@/shared/constants/messages/ProfileMessages";
import { CommonMessages } from "@/shared/constants/messages/CommonMessages";

interface DeletionConfirmationViewProps {
    deletionMode: "immediate" | "scheduled";
    onModeChange: (mode: "immediate" | "scheduled") => void;
    scheduleDays: number;
    reason: string;
    onReasonChange: (val: string) => void;
    onSubmit: () => void;
    showDialog: boolean;
    onDialogChange: (open: boolean) => void;
    onConfirm: () => void;
    isConfirming: boolean;
}

export const DeletionConfirmationView = ({
    deletionMode, onModeChange, scheduleDays, reason, onReasonChange, onSubmit,
    showDialog, onDialogChange, onConfirm, isConfirming
}: DeletionConfirmationViewProps) => {
    const { t } = useTranslation();

    return (
        <>
            <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
                <CardHeader className="p-8 border-b">
                    <CardTitle className="text-2xl font-bold text-[#2C1810]">{t(ProfileMessages.CHOOSE_DELETION_TYPE)}</CardTitle>
                    <CardDescription>{t(ProfileMessages.SELECT_DELETION_MODE)}</CardDescription>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                    <RadioGroup value={deletionMode} onValueChange={(v) => onModeChange(v as any)}>
                        <div className="space-y-4">
                            <div className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${deletionMode === "scheduled" ? "border-[#B85C3C] bg-orange-50" : "border-gray-200"}`} onClick={() => onModeChange("scheduled")}>
                                <div className="flex items-center gap-4">
                                    <RadioGroupItem value="scheduled" id="scheduled" />
                                    <div className="flex-1">
                                        <Label className="font-bold cursor-pointer">{t(ProfileMessages.SCHEDULED_DELETION)}</Label>
                                        <p className="text-sm text-muted-foreground mt-1">{t(ProfileMessages.SCHEDULED_DELETION_DESC)}</p>
                                    </div>
                                </div>
                                {deletionMode === "scheduled" && <div className="mt-2 pl-8"><p className="text-sm text-[#B85C3C] font-medium">{t(ProfileMessages.DAYS_NOTICE, { days: scheduleDays })}</p></div>}
                            </div>
                            <div className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${deletionMode === "immediate" ? "border-red-500 bg-red-50" : "border-gray-200"}`} onClick={() => onModeChange("immediate")}>
                                <div className="flex items-center gap-4">
                                    <RadioGroupItem value="immediate" id="immediate" />
                                    <div className="flex-1">
                                        <Label className="font-bold cursor-pointer text-red-900">{t(ProfileMessages.IMMEDIATE_DELETION)}</Label>
                                        <p className="text-sm text-red-700 mt-1">{t(ProfileMessages.IMMEDIATE_DELETION_DESC)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </RadioGroup>
                    <div className="space-y-2">
                        <Label htmlFor="account-deletion-reason">{t(ProfileMessages.REASON_LEAVING)}</Label>
                        <Textarea id="account-deletion-reason" placeholder={t(ProfileMessages.REASON_PLACEHOLDER)} value={reason} onChange={(e) => onReasonChange(e.target.value)} className="resize-none" rows={3} />
                    </div>
                    <Button className={`w-full h-14 rounded-xl ${deletionMode === "immediate" ? "bg-red-600 hover:bg-red-700" : "bg-[#B85C3C] hover:bg-[#2C1810]"}`} onClick={onSubmit}>
                        {deletionMode === "immediate" ? t(ProfileMessages.DELETE_NOW) : t(ProfileMessages.SCHEDULE_DELETION)}
                    </Button>
                </CardContent>
            </Card>

            <Dialog open={showDialog} onOpenChange={onDialogChange}>
                <DialogContent onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle className="text-red-600 flex items-center gap-2"><AlertTriangle className="h-5 w-5" />{deletionMode === "immediate" ? t(ProfileMessages.CONFIRM_IMMEDIATE) : t(ProfileMessages.CONFIRM_SCHEDULED)}</DialogTitle>
                        <DialogDescription>{deletionMode === "immediate" ? t(ProfileMessages.DELETION_WARNING_IMMEDIATE) : t(ProfileMessages.DELETION_WARNING_SCHEDULED, { days: scheduleDays })}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => onDialogChange(false)}>{t(CommonMessages.CANCEL)}</Button>
                        <Button variant="destructive" onClick={onConfirm} disabled={isConfirming}>
                            {isConfirming && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            {deletionMode === "immediate" ? t(ProfileMessages.DELETE_MY_ACCOUNT) : t(ProfileMessages.SCHEDULE_DELETION)}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};
