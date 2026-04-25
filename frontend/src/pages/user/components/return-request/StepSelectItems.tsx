import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { ReturnableItem } from "@/types";
import { Package } from "lucide-react";

interface StepSelectItemsProps {
    returnableItems: ReturnableItem[];
    selectedItems: { id: string; quantity: number }[];
    onToggleItem: (id: string, maxQuantity: number) => void;
    onUpdateQuantity: (id: string, quantity: number) => void;
    orderItems?: any[];
    formatAmount: (amount: number) => string;
}

export function StepSelectItems({ returnableItems, orderItems, selectedItems, onToggleItem, onUpdateQuantity, formatAmount }: StepSelectItemsProps) {
    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-sm font-medium text-slate-700">Select items to return</h3>
            <div className="space-y-3">
                {returnableItems.map((item) => {
                    const selectedItem = selectedItems.find((i) => i.id === item.id);
                    const isSelected = !!selectedItem;
                    const orderItem = orderItems?.find(oi => oi.id === item.id);
                    const displayImage = 
                        item.variant_snapshot?.variant_image_url || 
                        item.image_url || 
                        item.product?.images?.[0] || 
                        item.product?.main_image ||
                        item.product_snapshot?.main_image ||
                        item.variant?.variant_image_url ||
                        orderItem?.variant?.variant_image_url ||
                        orderItem?.product?.images?.[0] ||
                        orderItem?.product_snapshot?.main_image;

                    return (
                        <div
                            key={item.id}
                            className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer shadow-sm
                                ${isSelected ? "bg-orange-50/50 border-orange-200" : "bg-white border-slate-100 hover:border-slate-200"}`}
                            onClick={() => {
                                if (!isSelected) {
                                    onToggleItem(item.id, item.remaining_quantity);
                                } else {
                                    // Deselect if clicking the container and it's already selected
                                    onToggleItem(item.id, item.remaining_quantity);
                                }
                            }}
                        >
                            <Checkbox
                                checked={isSelected}
                                className="w-5 h-5 border-slate-300 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                            />
                            
                            <div className="w-16 h-16 rounded-lg bg-slate-50 border border-slate-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                                {displayImage ? (
                                    <img src={displayImage} alt={item.title} className="w-full h-full object-cover" />
                                ) : (
                                    <Package className="w-6 h-6 text-slate-300" />
                                )}
                            </div>

                            <div className="flex-1 space-y-1">
                                <p className="text-sm font-bold text-slate-800">{item.title}</p>
                                <p className="text-xs text-slate-500">
                                    Max Qty: {item.remaining_quantity} {item.variant_snapshot?.size_label ? `• ${item.variant_snapshot.size_label}` : ''}
                                </p>
                                <p className="text-sm font-bold text-emerald-700">
                                    {formatAmount(item.price_per_unit || 0)}
                                </p>
                            </div>

                            {isSelected && item.remaining_quantity > 1 && (
                                <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-100 p-1" onClick={e => e.stopPropagation()}>
                                    <button 
                                        type="button" 
                                        className="w-8 h-8 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-50 rounded-lg" 
                                        onClick={() => onUpdateQuantity(item.id, Math.max(1, selectedItem.quantity - 1))}
                                    >
                                        -
                                    </button>
                                    <span className="w-6 text-center text-xs font-bold text-slate-800">{selectedItem.quantity}</span>
                                    <button 
                                        type="button" 
                                        className="w-8 h-8 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-50 rounded-lg" 
                                        onClick={() => onUpdateQuantity(item.id, Math.min(item.remaining_quantity, selectedItem.quantity + 1))}
                                    >
                                        +
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
