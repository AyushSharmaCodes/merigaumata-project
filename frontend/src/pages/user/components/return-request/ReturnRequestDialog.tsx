import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OrderMessages } from "@/constants/messages/OrderMessages";
import { CommonMessages } from "@/constants/messages/CommonMessages";
import { useToast } from "@/hooks/use-toast";
import { ReturnStepper } from "./ReturnStepper";
import { StepSelectItems } from "./StepSelectItems";
import { StepReturnDetails } from "./StepReturnDetails";
import { StepUploadProof } from "./StepUploadProof";
import { MAX_USER_IMAGE_SIZE_BYTES } from "@/constants/upload.constants";
import { ReturnableItem } from "@/types";

interface ReturnRequestDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (
        selectedItems: { id: string; quantity: number }[],
        reasonCategory: string,
        specificReason: string,
        additionalDetails: string,
        images: File[]
    ) => Promise<void>;
    returnableItems: ReturnableItem[];
    orderItems: any[];
    orderNumber?: string;
    orderDeliveryCharge?: number;
    formatAmount: (amount: number) => string;
    isLoading?: boolean;
    isDataLoading?: boolean;
}

export function ReturnRequestDialog({
    isOpen,
    onClose,
    onSubmit,
    returnableItems,
    orderItems,
    orderNumber,
    orderDeliveryCharge = 0,
    formatAmount,
    isLoading = false,
    isDataLoading = false
}: ReturnRequestDialogProps) {
    const { t } = useTranslation();
    const { toast } = useToast();

    const [step, setStep] = useState(1);
    
    // Step 1 State
    const [selectedItems, setSelectedItems] = useState<{ id: string; quantity: number }[]>([]);
    
    // Step 2 State
    const [selectedCategory, setSelectedCategory] = useState("");
    const [selectedReasonKey, setSelectedReasonKey] = useState("");
    const [additionalDetails, setAdditionalDetails] = useState("");

    // Step 3 State
    const [images, setImages] = useState<File[]>([]);
    
    // UI Logic States
    const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

    const handleToggleItem = (id: string, maxQuantity: number) => {
        setSelectedItems(prev => {
            const exists = prev.find(i => i.id === id);
            if (exists) {
                return prev.filter(i => i.id !== id);
            }
            return [...prev, { id, quantity: maxQuantity }];
        });
    };

    const handleUpdateQuantity = (id: string, quantity: number) => {
        setSelectedItems(prev => prev.map(i => i.id === id ? { ...i, quantity } : i));
    };

    const handleAddImages = (files: File[]) => {
        const newFiles = [...images, ...files];
        
        if (newFiles.length > 3) {
            toast({
                title: "Too many photos",
                description: "You can upload a maximum of 3 photos.",
                variant: "destructive",
            });
            return;
        }

        const invalidFile = newFiles.find(f => f.size > MAX_USER_IMAGE_SIZE_BYTES);
        if (invalidFile) {
            toast({
                title: "File too large",
                description: `File ${invalidFile.name} exceeds the 5MB limit.`,
                variant: "destructive",
            });
            return;
        }

        setImages(newFiles);
    };

    const handleRemoveImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleNext = () => {
        if (step === 1 && selectedItems.length === 0) {
            toast({
                title: "Selection Required",
                description: "Please select at least one item to return.",
                variant: "destructive",
            });
            return;
        }

        if (step === 2) {
            if (!selectedCategory) {
                toast({
                    title: "Reason Required",
                    description: "Please select a reason for the return.",
                    variant: "destructive",
                });
                return;
            }
            // Require specific reason if not "other"
            if (!selectedReasonKey) {
                toast({
                    title: "Specific Reason Required",
                    description: "Please select a specific reason from the dropdown.",
                    variant: "destructive",
                });
                return;
            }
            if (selectedReasonKey === 'other' && !additionalDetails.trim()) {
                 toast({
                    title: "Details Required",
                    description: "Please provide details for 'Other' reason.",
                    variant: "destructive",
                });
                return;
            }
        }

        setStep(prev => Math.min(prev + 1, 3));
        setHasScrolledToBottom(false); // Reset for next step if needed
    };

    const handleBack = () => {
        setStep(prev => Math.max(prev - 1, 1));
        setHasScrolledToBottom(true); // Usually already viewed if going back
    };

    const handleSubmit = async () => {
        if (images.length === 0) {
            toast({
                title: "Proof Required",
                description: "Please upload at least one photo as proof.",
                variant: "destructive",
            });
            return;
        }

        await onSubmit(selectedItems, selectedCategory, selectedReasonKey, additionalDetails, images);
    };

    // Reset state when modal is closed
    const handleClose = () => {
        if (!isLoading) {
            setStep(1);
            setAdditionalDetails("");
            setImages([]);
            setHasScrolledToBottom(false);
            onClose();
        }
    };

    // Compute Refund Summary
    let productRefund = 0;
    let deliveryRefund = 0;
    let deliveryNonRefund = 0;

    selectedItems.forEach(sel => {
        const rItem = returnableItems.find(i => i.id === sel.id);
        const oItem = orderItems?.find(i => i.id === sel.id);
        
        if (rItem) {
            productRefund += sel.quantity * (rItem.price_per_unit || 0);
        }
        
        if (oItem) {
            const deliveryPolicy = oItem.delivery_calculation_snapshot?.delivery_refund_policy;
            const itemLineTotalDelivery = (oItem.delivery_charge || 0) + (oItem.delivery_gst || 0);
            // Pro-rate the delivery charge based on the quantity being returned
            const itemProRatedDelivery = (itemLineTotalDelivery / oItem.quantity) * sel.quantity;
            
            if (deliveryPolicy === 'REFUNDABLE') {
                deliveryRefund += itemProRatedDelivery;
            }
        }
    });
    
    // The total delivery paid for the whole order
    const totalOrderDeliveryPaid = orderDeliveryCharge;
    // Anything not refunded is non-refundable
    deliveryNonRefund = Math.max(0, totalOrderDeliveryPaid - deliveryRefund);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent 
                onInteractOutside={(e) => e.preventDefault()} 
                className="sm:max-w-xl max-h-[85vh] flex flex-col rounded-[40px] overflow-hidden border-none shadow-2xl bg-white p-0 gap-0 [&>button.absolute]:hidden"
            >
                
                {/* Header */}
                <div className="p-6 pb-2 relative bg-white rounded-t-[32px]">
                    <div className="flex justify-between items-start">
                        <div>
                            <DialogTitle className="text-lg font-bold text-slate-800">New Return Request</DialogTitle>
                            {orderNumber && (
                                <DialogDescription className="text-sm text-slate-500 mt-1">
                                    Order #{orderNumber}
                                </DialogDescription>
                            )}
                        </div>
                        <button onClick={handleClose} disabled={isLoading} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <ReturnStepper currentStep={step} />
                </div>

                {/* Content Area */}
                <div className="flex-1 min-h-0 overflow-y-auto p-8 custom-scrollbar">
                    {isDataLoading ? (
                        <div className="flex flex-col items-center justify-center h-48 gap-4">
                            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                                Loading returnable items...
                            </p>
                        </div>
                    ) : (
                        <>
                            {step === 1 && (
                                <StepSelectItems
                                    returnableItems={returnableItems}
                                    orderItems={orderItems}
                                    selectedItems={selectedItems}
                                    onToggleItem={handleToggleItem}
                                    onUpdateQuantity={handleUpdateQuantity}
                                    formatAmount={formatAmount}
                                />
                            )}
                            {step === 2 && (
                                <StepReturnDetails
                                    selectedCategory={selectedCategory}
                                    onCategoryChange={setSelectedCategory}
                                    selectedReasonKey={selectedReasonKey}
                                    onReasonKeyChange={setSelectedReasonKey}
                                    additionalDetails={additionalDetails}
                                    onDetailsChange={setAdditionalDetails}
                                    productRefund={productRefund}
                                    deliveryRefund={deliveryRefund}
                                    deliveryNonRefund={deliveryNonRefund}
                                    formatAmount={formatAmount}
                                    onScrolledToBottom={setHasScrolledToBottom}
                                />
                            )}
                            {step === 3 && (
                                <StepUploadProof
                                    images={images}
                                    onAddImages={handleAddImages}
                                    onRemoveImage={handleRemoveImage}
                                />
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-8 bg-white border-t border-slate-100 flex items-center justify-between">
                    {step > 1 ? (
                        <Button
                            variant="ghost"
                            onClick={handleBack}
                            disabled={isLoading}
                            className="rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-50 px-6 font-bold uppercase tracking-widest text-[10px]"
                        >
                            Back
                        </Button>
                    ) : (
                        <Button
                            variant="ghost"
                            onClick={handleClose}
                            disabled={isLoading}
                            className="rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-50 px-6 font-bold uppercase tracking-widest text-[10px]"
                        >
                            Cancel
                        </Button>
                    )}

                    <Button
                        onClick={step === 3 ? handleSubmit : handleNext}
                        disabled={
                            (step === 1 && selectedItems.length === 0) ||
                            (step === 2 && (!selectedCategory || !selectedReasonKey)) ||
                            (step === 3 && images.length === 0) ||
                            isLoading
                        }
                        className={`rounded-full bg-[#2C1810] hover:bg-[#B85C3C] text-white px-10 h-12 font-bold uppercase tracking-widest text-xs shadow-lg transition-all
                            ${step === 2 && !hasScrolledToBottom ? "opacity-0 pointer-events-none translate-y-4" : "opacity-100 translate-y-0"}
                        `}
                    >
                        {isLoading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                        {step === 3 ? "Submit Request" : "Continue"}
                    </Button>
                </div>

            </DialogContent>
        </Dialog>
    );
}
