import React from "react";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { RETURN_REASONS } from "@/features/returns/constants/returnReasons";

interface StepReturnDetailsProps {
    selectedCategory: string;
    onCategoryChange: (category: string) => void;
    selectedReasonKey: string;
    onReasonKeyChange: (key: string) => void;
    additionalDetails: string;
    onDetailsChange: (details: string) => void;
    productRefund: number;
    deliveryRefund: number;
    deliveryNonRefund: number;
    formatAmount: (amount: number) => string;
    onScrolledToBottom?: (scrolled: boolean) => void;
}

export function StepReturnDetails({
    selectedCategory,
    onCategoryChange,
    selectedReasonKey,
    onReasonKeyChange,
    additionalDetails,
    onDetailsChange,
    productRefund,
    deliveryRefund,
    deliveryNonRefund,
    formatAmount,
    onScrolledToBottom,
}: StepReturnDetailsProps) {
    const sentinelRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (!onScrolledToBottom) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    onScrolledToBottom(true);
                }
            },
            { threshold: 1.0 }
        );

        if (sentinelRef.current) {
            observer.observe(sentinelRef.current);
        }

        return () => observer.disconnect();
    }, [onScrolledToBottom]);

    const activeCategory = RETURN_REASONS.find(c => c.category === selectedCategory);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 pb-4">
            {/* Question Section */}
            <div className="space-y-4">
                <div className="flex items-center gap-3 px-1">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                        <span className="text-emerald-700 text-sm font-black">2</span>
                    </div>
                    <h3 className="text-lg font-black text-slate-800 tracking-tight">Reason for Return</h3>
                </div>
                
                <div className="grid grid-cols-1 gap-3 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar p-1">
                    {RETURN_REASONS.map((cat) => (
                        <div key={cat.category} className="space-y-2">
                            <button
                                type="button"
                                onClick={() => {
                                    onCategoryChange(cat.category);
                                    if (cat.reasons.length === 1) {
                                        onReasonKeyChange(cat.reasons[0].key);
                                    } else {
                                        onReasonKeyChange("");
                                    }
                                }}
                                className={`w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-all duration-300
                                    ${selectedCategory === cat.category 
                                        ? "bg-emerald-50 border-emerald-200 shadow-md shadow-emerald-600/5 ring-1 ring-emerald-200" 
                                        : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50 shadow-sm"}
                                `}
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-transform duration-300
                                    ${selectedCategory === cat.category ? "bg-white scale-110 shadow-sm" : "bg-slate-50"}
                                `}>
                                    {cat.icon}
                                </div>
                                <div className="flex-1">
                                    <p className={`text-sm font-bold transition-colors ${selectedCategory === cat.category ? "text-emerald-900" : "text-slate-700"}`}>
                                        {cat.category}
                                    </p>
                                    {selectedCategory === cat.category && cat.reasons.length > 1 && (
                                        <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mt-0.5">
                                            Select specific reason below
                                        </p>
                                    )}
                                </div>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all
                                    ${selectedCategory === cat.category ? "border-emerald-600 bg-emerald-600" : "border-slate-200"}
                                `}>
                                    {selectedCategory === cat.category && (
                                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                                    )}
                                </div>
                            </button>

                            {/* Sub-reasons Selection */}
                            {selectedCategory === cat.category && cat.reasons.length > 1 && (
                                <div className="ml-4 mr-1 p-2 bg-white rounded-2xl border border-emerald-100 shadow-inner animate-in slide-in-from-top-2 duration-300">
                                    <div className="grid grid-cols-1 gap-1">
                                        {cat.reasons.map((r) => (
                                            <button
                                                key={r.key}
                                                type="button"
                                                onClick={() => onReasonKeyChange(r.key)}
                                                className={`text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-all
                                                    ${selectedReasonKey === r.key 
                                                        ? "bg-emerald-600 text-white shadow-md" 
                                                        : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"}
                                                `}
                                            >
                                                {r.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Details Section */}
            <div className="space-y-3 bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center px-1">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                        Additional Details
                    </Label>
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-wider bg-slate-50 px-2 py-0.5 rounded-full">Optional</span>
                </div>
                <Textarea
                    placeholder="Tell us more about the issue to help us improve..."
                    value={additionalDetails}
                    onChange={(e) => onDetailsChange(e.target.value)}
                    className="min-h-[100px] rounded-2xl border-slate-100 bg-slate-50 p-4 focus:bg-white focus:ring-emerald-500/20 focus:border-emerald-200 transition-all text-xs resize-none leading-relaxed text-slate-700 placeholder:text-slate-300 border-2"
                />
            </div>

            {/* Refund Summary Card */}
            <div className="relative overflow-hidden rounded-[24px] border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/30 p-6 shadow-md shadow-emerald-600/5">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                
                <h4 className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    Refund Estimate
                </h4>
                
                <div className="space-y-3 relative z-10">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium tracking-tight">Returnable Value</span>
                        <span className="font-bold text-slate-800">{formatAmount(productRefund)}</span>
                    </div>
                    
                    {deliveryRefund > 0 && (
                        <div className="flex justify-between items-center text-xs p-2 bg-emerald-50/50 rounded-lg border border-emerald-100/50">
                            <span className="text-emerald-700 font-bold tracking-tight">Refundable Delivery Fee</span>
                            <span className="font-black text-emerald-700">+{formatAmount(deliveryRefund)}</span>
                        </div>
                    )}
                    
                    {deliveryNonRefund > 0 && (
                        <div className="flex justify-between items-center text-[10px] p-2 bg-slate-50 rounded-lg border border-slate-100 opacity-60">
                            <span className="text-slate-500 font-bold tracking-tight italic">Note: Non-Refundable Delivery Fee</span>
                            <span className="font-bold text-slate-500">{formatAmount(deliveryNonRefund)}</span>
                        </div>
                    )}
                    
                    <div className="pt-4 border-t border-emerald-100 flex justify-between items-end">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Estimated Total Refund</p>
                            <p className="text-[9px] text-slate-400 leading-tight italic max-w-[180px]">Subject to physical inspection</p>
                        </div>
                        <div className="text-right">
                            <span className="text-2xl font-black text-emerald-600 tracking-tighter">
                                {formatAmount(productRefund + deliveryRefund)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sentinel for scroll tracking */}
            <div ref={sentinelRef} className="h-4 w-full" />
        </div>
    );
}
