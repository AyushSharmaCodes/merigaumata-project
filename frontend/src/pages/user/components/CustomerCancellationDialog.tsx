import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { XCircle, HelpCircle } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CUSTOMER_CANCELLATION_REASONS } from "../constants/customerCancellationReasons";

interface CustomerCancellationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => Promise<void>;
    isLoading: boolean;
}

export function CustomerCancellationDialog({
    isOpen,
    onClose,
    onConfirm,
    isLoading,
}: CustomerCancellationDialogProps) {
    const { t } = useTranslation();
    const [selectedKey, setSelectedKey] = useState<string>("");
    const [customNote, setCustomNote] = useState<string>("");

    const handleConfirm = useCallback(async () => {
        let finalReason = "";
        if (selectedKey === "other") {
            finalReason = customNote.trim();
        } else {
            // Find the reason in the constants
            let foundReasonLabel = "";
            for (const category of CUSTOMER_CANCELLATION_REASONS) {
                const reason = category.reasons.find(r => r.key === selectedKey);
                if (reason) {
                    foundReasonLabel = reason.label;
                    break;
                }
            }
            finalReason = `[${selectedKey.toUpperCase()}] ${foundReasonLabel}`;
        }

        if (finalReason) {
            await onConfirm(finalReason);
            setSelectedKey("");
            setCustomNote("");
        }
    }, [selectedKey, customNote, onConfirm]);

    const isConfirmDisabled = useMemo(() => {
        if (isLoading) return true;
        if (!selectedKey) return true;
        if (selectedKey === "other" && !customNote.trim()) return true;
        return false;
    }, [isLoading, selectedKey, customNote]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open) {
                onClose();
                setSelectedKey("");
                setCustomNote("");
            }
        }}>
            <DialogContent className="max-w-[450px]">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <XCircle className="h-6 w-6 text-red-500" />
                        {t("orderDetail.cancelTitle", "Cancel Your Order")}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground pt-2">
                        {t("orderDetail.cancelDesc", "We're sorry to see you go. Please let us know why you're cancelling so we can improve your experience.")}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            {t("orderDetail.cancelReason", "Why are you cancelling?")} <span className="text-red-500">*</span>
                        </label>
                        <Select value={selectedKey} onValueChange={setSelectedKey}>
                            <SelectTrigger className="w-full text-sm">
                                <SelectValue placeholder={t("orderDetail.cancelPlaceholder", "Choose a reason...")} />
                            </SelectTrigger>
                            <SelectContent className="max-h-[350px]">
                                {CUSTOMER_CANCELLATION_REASONS.map((category) => (
                                    <SelectGroup key={category.category}>
                                        <SelectLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-slate-50/80 py-1.5 px-4 flex items-center gap-2">
                                            {category.icon ? <category.icon className="h-3 w-3 opacity-70" /> : <HelpCircle className="h-3 w-3 opacity-70" />}
                                            <span>{category.category}</span>
                                        </SelectLabel>
                                        {category.reasons.map((reason) => (
                                            <SelectItem 
                                                key={reason.key} 
                                                value={reason.key}
                                                className="text-sm pl-8"
                                            >
                                                {reason.label}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedKey === "other" && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                {t("orderDetail.detailsLabel", "Please specify")}
                            </label>
                            <Textarea
                                placeholder={t("orderDetail.reasonPlaceholder", "Give us a bit more detail...")}
                                value={customNote}
                                onChange={(e) => setCustomNote(e.target.value)}
                                className="text-sm min-h-[100px] resize-none"
                            />
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0 mt-2">
                    <Button 
                        variant="outline" 
                        onClick={onClose} 
                        disabled={isLoading}
                        className="flex-1 sm:flex-none"
                    >
                        {t("orderDetail.keepOrder", "Keep My Order")}
                    </Button>
                    <Button 
                        variant="destructive" 
                        onClick={handleConfirm} 
                        disabled={isConfirmDisabled}
                        className="flex-1 sm:flex-none"
                    >
                        {isLoading ? t("common.updating") : t("orderDetail.confirmCancel", "Cancel Order")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
