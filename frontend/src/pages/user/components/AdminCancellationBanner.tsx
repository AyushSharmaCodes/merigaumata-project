import React from "react";
import { AlertCircle, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

interface AdminCancellationBannerProps {
    type: 'order' | 'return';
    reason: string;
    explanation?: string;
}

export const AdminCancellationBanner: React.FC<AdminCancellationBannerProps> = ({ 
    type, 
    reason, 
    explanation 
}) => {
    const isOrder = type === 'order';
    
    // Default professional explanations if none provided
    const defaultExplanation = isOrder 
        ? "We sincerely apologize. Your order did not meet our quality standards prior to dispatch or is currently out of stock. Your order has been cancelled."
        : "We sincerely apologize. After reviewing your return request, we found it did not meet our return policy requirements. Your request has been rejected.";

    return (
        <div className="space-y-6">
            {/* Status Badge */}
            <div className="flex justify-end">
                <div className="inline-flex items-center gap-2 bg-[#FEE2E2] px-6 py-2.5 rounded-full border border-[#FECACA]">
                    <XCircle className="h-4 w-4 text-[#991B1B] fill-[#991B1B] stroke-white" />
                    <span className="text-[12px] font-black uppercase tracking-[0.15em] text-[#991B1B]">
                        {isOrder ? "ADMIN CANCELLED" : "RETURN REJECTED"}
                    </span>
                </div>
            </div>

            {/* Banner Section */}
            <Card className="relative overflow-hidden bg-[#F3EFE7] border-none shadow-xl rounded-[32px] p-8 md:p-10">
                {/* Red Left Accent Border */}
                <div className="absolute top-0 left-0 w-[6px] h-full bg-[#C22D2D]" />
                
                <div className="flex items-start gap-6">
                    <div className="shrink-0 mt-1">
                        <div className="w-8 h-8 rounded-full bg-[#C22D2D] flex items-center justify-center">
                            <AlertCircle className="h-5 w-5 text-[#F3EFE7] stroke-[3px]" />
                        </div>
                    </div>
                    
                    <div className="space-y-3">
                        <h3 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">
                            Admin {isOrder ? "Cancellation" : "Rejection"} Reason: {reason}
                        </h3>
                        <p className="text-sm md:text-base font-medium text-slate-600 max-w-3xl leading-relaxed">
                            {explanation || defaultExplanation}
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
};
