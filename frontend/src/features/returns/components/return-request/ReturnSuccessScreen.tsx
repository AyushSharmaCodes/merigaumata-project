import React from "react";
import { Check, ClipboardList, Truck, Banknote, Info } from "lucide-react";
import { Button } from "@/shared/components/ui/button";

interface ReturnSuccessScreenProps {
    orderNumber: string;
    returnRequestId: string;
    onBackToOrder: () => void;
    onContactSupport: () => void;
}

export function ReturnSuccessScreen({
    orderNumber,
    returnRequestId,
    onBackToOrder,
    onContactSupport
}: ReturnSuccessScreenProps) {
    return (
        <div className="max-w-4xl mx-auto px-4 py-12 animate-in fade-in zoom-in-95 duration-500">
            <div className="flex flex-col items-center text-center mb-10">
                <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6 border-8 border-white shadow-sm">
                    <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center text-white">
                        <Check strokeWidth={3} className="w-6 h-6" />
                    </div>
                </div>
                
                <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-3">
                    Return Request Submitted
                </h1>
                <p className="text-slate-500 max-w-md">
                    Your request for Order <span className="font-bold text-slate-800">#{orderNumber}</span> has been received and is being reviewed by our team.
                </p>
            </div>

            <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between mb-10 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-2 bg-emerald-600 rounded-l-2xl"></div>
                
                <div className="mb-4 md:mb-0 pl-4 text-center md:text-left">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                        Return Request ID
                    </p>
                    <p className="text-2xl font-black text-slate-800 tracking-tight">
                        {returnRequestId}
                    </p>
                </div>

                <div className="bg-emerald-100 text-emerald-800 px-4 py-2 rounded-full text-sm font-bold shadow-sm border border-emerald-200">
                    Status: Pending Review
                </div>
            </div>

            <div className="mb-10">
                <div className="flex items-center gap-2 mb-6 text-slate-800">
                    <Info className="w-5 h-5 text-emerald-700" fill="currentColor" stroke="white" />
                    <h3 className="text-lg font-bold">What happens next?</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Step 1 */}
                    <div className="bg-[#FAF8F5] p-6 rounded-2xl border border-slate-100/50">
                        <div className="w-10 h-10 bg-emerald-100/50 rounded-xl flex items-center justify-center mb-4 border border-emerald-100">
                            <ClipboardList className="w-5 h-5 text-emerald-700" />
                        </div>
                        <h4 className="font-bold text-slate-800 mb-2">Admin Review</h4>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Our team will review your request within 24-48 hours.
                        </p>
                    </div>

                    {/* Step 2 */}
                    <div className="bg-[#FAF8F5] p-6 rounded-2xl border border-slate-100/50">
                        <div className="w-10 h-10 bg-emerald-100/50 rounded-xl flex items-center justify-center mb-4 border border-emerald-100">
                            <Truck className="w-5 h-5 text-emerald-700" />
                        </div>
                        <h4 className="font-bold text-slate-800 mb-2">Pickup Scheduling</h4>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Once approved, we'll schedule a pickup at your address.
                        </p>
                    </div>

                    {/* Step 3 */}
                    <div className="bg-[#FAF8F5] p-6 rounded-2xl border border-slate-100/50">
                        <div className="w-10 h-10 bg-emerald-100/50 rounded-xl flex items-center justify-center mb-4 border border-emerald-100">
                            <Banknote className="w-5 h-5 text-emerald-700" />
                        </div>
                        <h4 className="font-bold text-slate-800 mb-2">Refund Process</h4>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Refunds are initiated after the item passes quality check.
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button 
                    onClick={onBackToOrder}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto px-8 py-6 rounded-xl text-base font-bold shadow-lg shadow-emerald-600/20"
                >
                    Back to Order Details
                </Button>
                <Button 
                    onClick={onContactSupport}
                    variant="outline"
                    className="bg-[#F3EFEA] hover:bg-[#EAE4DD] text-slate-800 border-transparent w-full sm:w-auto px-8 py-6 rounded-xl text-base font-bold"
                >
                    Contact Support
                </Button>
            </div>
        </div>
    );
}
