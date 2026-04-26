import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { XCircle } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { CANCELLATION_REASONS } from "@/domains/order/model/constants/cancellationReasons";

interface OrderCancellationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => Promise<void>;
    isLoading: boolean;
}

export function OrderCancellationDialog({
    isOpen,
    onClose,
    onConfirm,
    isLoading,
}: OrderCancellationDialogProps) {
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
            for (const category of CANCELLATION_REASONS) {
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
        <AlertDialog open={isOpen} onOpenChange={(open) => {
            if (!open) {
                onClose();
                setSelectedKey("");
                setCustomNote("");
            }
        }}>
            <AlertDialogContent className="max-w-[450px]">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-red-600 font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                        <XCircle className="h-5 w-5" />
                        {t("admin.orders.detail.dialogs.confirmCancel.title", "Confirm Order Cancellation")}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-xs font-semibold text-slate-500 leading-relaxed pt-2">
                        {t("admin.orders.detail.dialogs.confirmCancel.description", "Select a reason for cancelling this order. This message will be shared with the customer.")}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {t("admin.orders.detail.dialogs.confirmCancel.reasonLabel", "Cancellation Reason")}
                        </label>
                        <Select value={selectedKey} onValueChange={setSelectedKey}>
                            <SelectTrigger className="text-xs font-bold border-slate-200">
                                <SelectValue placeholder={t("admin.orders.detail.dialogs.confirmCancel.selectPlaceholder", "Select a reason...")} />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                                {CANCELLATION_REASONS.map((category) => (
                                    <SelectGroup key={category.category}>
                                        <SelectLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50/50 py-1.5 px-4 flex items-center gap-2">
                                            {category.icon && <category.icon className="h-3 w-3 opacity-70" />}
                                            <span>{category.category}</span>
                                        </SelectLabel>
                                        {category.reasons.map((reason) => (
                                            <SelectItem 
                                                key={reason.key} 
                                                value={reason.key}
                                                className="text-xs font-bold pl-8"
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
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                {t("admin.orders.detail.dialogs.confirmCancel.detailsLabel", "Additional Details")}
                            </label>
                            <Textarea
                                placeholder={t("admin.orders.detail.dialogs.confirmCancel.reasonPlaceholder", "Enter specific cancellation details...")}
                                value={customNote}
                                onChange={(e) => setCustomNote(e.target.value)}
                                className="text-xs font-bold min-h-[100px] border-slate-200 focus:ring-red-100 focus:border-red-200"
                            />
                        </div>
                    )}
                </div>

                <AlertDialogFooter className="border-t border-slate-50 pt-4">
                    <AlertDialogCancel 
                        disabled={isLoading}
                        className="text-xs font-bold border-slate-200"
                        onClick={onClose}
                    >
                        {t("common.cancel")}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault();
                            handleConfirm();
                        }}
                        disabled={isConfirmDisabled}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-lg shadow-red-200"
                    >
                        {isLoading ? t("common.updating") : t("admin.orders.detail.dialogs.confirmCancel.confirm", "Yes, Cancel Order")}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
