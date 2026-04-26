import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/components/ui/select";
import { Search, Check, Loader2 } from "lucide-react";
import { Coupon } from "@/shared/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/shared/components/ui/command";
import { cn } from "@/core/utils/utils";
import { useCouponDialog } from "../hooks/useCouponDialog";

interface CouponDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    coupon?: Coupon | null;
    onSave: () => void;
}

export const CouponDialog: React.FC<CouponDialogProps> = (props) => {
    const { coupon, open, onOpenChange } = props;
    const {
        t,
        loading,
        categories,
        loadingCategories,
        formData,
        searchTerm,
        searchResults,
        isSearching,
        openSelector,
        selectedEntityName,
        isLoadingCoupon,
        setSearchTerm,
        setOpenSelector,
        handleChange,
        handleSubmit,
    } = useCouponDialog(props);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent 
                className="max-w-2xl max-h-[90vh] overflow-y-auto"
                onInteractOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle>
                        {coupon ? t("admin.coupons.dialog.editTitle") : t("admin.coupons.dialog.addTitle")}
                    </DialogTitle>
                    <DialogDescription>
                        {coupon
                            ? t("admin.coupons.dialog.editSubtitle")
                            : t("admin.coupons.dialog.addSubtitle")}
                    </DialogDescription>
                </DialogHeader>

                {coupon && isLoadingCoupon ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <span className="text-sm font-medium">{t("common.loading", { defaultValue: "Loading details..." })}</span>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Code */}
                    <div className="grid gap-2">
                        <Label htmlFor="code">
                            {t("admin.coupons.dialog.codeLabel")} <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="code"
                            value={formData.code}
                            onChange={(e) =>
                                handleChange("code", e.target.value.toUpperCase())
                            }
                            placeholder={t("admin.coupons.dialog.codePlaceholder")}
                            disabled={loading}
                            required
                        />
                    </div>

                    {/* Type */}
                    <div className="grid gap-2">
                        <Label>
                            {t("admin.coupons.dialog.typeLabel")} <span className="text-destructive">*</span>
                        </Label>
                        <Select
                            value={formData.type}
                            onValueChange={(value: "cart" | "category" | "product" | "variant" | "free_delivery") => {
                                handleChange("type", value);
                                // Clear target_id when switching types
                                handleChange("target_id", undefined);
                            }}
                            disabled={loading}
                        >
                            <SelectTrigger aria-label={t("admin.coupons.dialog.typeLabel")}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent usePortal={false}>
                                <SelectItem value="cart">{t("admin.coupons.dialog.types.cart")}</SelectItem>
                                <SelectItem value="category">{t("admin.coupons.dialog.types.category")}</SelectItem>
                                <SelectItem value="product">{t("admin.coupons.dialog.types.product")}</SelectItem>
                                <SelectItem value="variant">{t("admin.coupons.dialog.types.variant")}</SelectItem>
                                <SelectItem value="free_delivery">{t("admin.coupons.dialog.types.freeDelivery")}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Target ID (for product, variant or category) */}
                    {(formData.type === "product" || formData.type === "variant") && (
                        <div className="grid gap-2">
                            <Label>
                                {t("admin.coupons.dialog.selectTarget", { type: formData.type })} <span className="text-destructive">*</span>
                            </Label>

                            <Popover open={openSelector} onOpenChange={setOpenSelector}>
                                <PopoverTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openSelector}
                                        className="w-full justify-between font-normal h-11 rounded-xl"
                                        disabled={loading}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            {formData.target_id ? (
                                                <>
                                                    <div className="w-2 h-2 rounded-full bg-primary" />
                                                    <span className="truncate">{selectedEntityName || formData.target_id}</span>
                                                </>
                                            ) : (
                                                <span className="text-muted-foreground">{t("admin.coupons.dialog.searchPlaceholder", { type: formData.type })}</span>
                                            )}
                                        </div>
                                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent usePortal={false} className="w-[--radix-popover-trigger-width] p-0 rounded-xl shadow-2xl border-primary/10">
                                    <Command shouldFilter={false} className="flex flex-col">
                                        <CommandInput
                                            placeholder={t("admin.coupons.dialog.searchPlaceholder", { type: formData.type })}
                                            onValueChange={setSearchTerm}
                                            value={searchTerm}
                                        />
                                        <CommandList className="max-h-[300px] overflow-y-auto w-full">
                                            <CommandEmpty className="py-6 text-center text-sm">
                                                {isSearching ? (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                        <span>{t("admin.coupons.dialog.searching")}</span>
                                                    </div>
                                                ) : (
                                                    t("admin.coupons.dialog.noResults")
                                                )}
                                            </CommandEmpty>
                                            <CommandGroup>
                                                {searchResults
                                                    .map(product => {
                                                        const matchedVariants = formData.type === 'variant'
                                                            ? (product.variants || []).filter(v =>
                                                                !searchTerm ||
                                                                v.size_label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                                product.title.toLowerCase().includes(searchTerm.toLowerCase())
                                                            )
                                                            : [];

                                                        if (formData.type === 'variant' && searchTerm && matchedVariants.length === 0) return null;

                                                        return (
                                                            <div key={product.id}>
                                                                {formData.type === 'product' ? (
                                                                    <CommandItem
                                                                        value={product.id}
                                                                        onSelect={() => {
                                                                            handleChange("target_id", product.id);
                                                                            // Note: selectedEntityName is handled in effect or by manual set if needed
                                                                            // But for simplicity, the hook handles it.
                                                                            setOpenSelector(false);
                                                                        }}
                                                                        className="flex items-center gap-2 p-3"
                                                                    >
                                                                        <Check
                                                                            className={cn(
                                                                                "h-4 w-4 text-primary",
                                                                                formData.target_id === product.id ? "opacity-100" : "opacity-0"
                                                                            )}
                                                                        />
                                                                        <div className="flex-1">
                                                                            <div className="font-bold">{product.title}</div>
                                                                            <div className="text-[10px] text-muted-foreground uppercase">{product.category}</div>
                                                                        </div>
                                                                    </CommandItem>
                                                                ) : (
                                                                    <div className="px-2 py-1.5">
                                                                        <div className="text-[10px] font-black text-primary/50 uppercase px-2 mb-1">{t("admin.coupons.dialog.variantsAvailable")}</div>
                                                                        {matchedVariants.length > 0 ? (
                                                                            matchedVariants.map((v) => (
                                                                                <CommandItem
                                                                                    key={v.id}
                                                                                    value={v.id}
                                                                                    onSelect={() => {
                                                                                        handleChange("target_id", v.id);
                                                                                        setOpenSelector(false);
                                                                                    }}
                                                                                    className="flex items-center gap-2 p-2 ml-2 rounded-lg cursor-pointer hover:bg-accent"
                                                                                >
                                                                                    <Check
                                                                                        className={cn(
                                                                                            "h-4 w-4 text-primary",
                                                                                            formData.target_id === v.id ? "opacity-100" : "opacity-0"
                                                                                        )}
                                                                                    />
                                                                                    <div className="flex-1">
                                                                                        <div className="font-medium">{v.size_label}</div>
                                                                                        <div className="text-[10px] text-muted-foreground">₹{v.selling_price} • Stock: {v.stock_quantity}</div>
                                                                                    </div>
                                                                                </CommandItem>
                                                                            ))
                                                                        ) : (
                                                                            <div className="text-[10px] italic text-muted-foreground px-4 py-1">{t("admin.coupons.dialog.noVariants")}</div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                    )}

                    {formData.type === "category" && (
                        <div className="grid gap-2">
                            <Label>
                                {t("admin.coupons.dialog.types.category")} <span className="text-destructive">*</span>
                            </Label>
                            <Select
                                value={formData.target_id || ""}
                                onValueChange={(value) => handleChange("target_id", value)}
                                disabled={loading || loadingCategories}
                            >
                                <SelectTrigger aria-label={t("admin.coupons.dialog.typeLabel")}>
                                    <SelectValue placeholder={loadingCategories ? t("admin.coupons.dialog.loadingCategories") : t("admin.coupons.dialog.selectCategory")} />
                                </SelectTrigger>
                                <SelectContent usePortal={false}>
                                    {categories.map((category) => (
                                        <SelectItem key={category} value={category}>
                                            {category}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Discount Percentage */}
                    {formData.type !== 'free_delivery' && (
                        <div className="grid gap-2">
                            <Label htmlFor="discount">
                                {t("admin.coupons.dialog.discountLabel")} <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="discount"
                                type="number"
                                min="1"
                                max="100"
                                value={formData.discount_percentage}
                                onChange={(e) =>
                                    handleChange("discount_percentage", parseInt(e.target.value))
                                }
                                disabled={loading}
                                required
                            />
                        </div>
                    )}

                    {formData.type !== 'free_delivery' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="min_purchase">{t("admin.coupons.dialog.minPurchaseLabel")}</Label>
                                <Input
                                    id="min_purchase"
                                    type="number"
                                    min="0"
                                    value={formData.min_purchase_amount || ""}
                                    onChange={(e) =>
                                        handleChange(
                                            "min_purchase_amount",
                                            e.target.value ? parseFloat(e.target.value) : undefined
                                        )
                                    }
                                    placeholder={t("admin.coupons.dialog.noMinimum")}
                                    disabled={loading}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="max_discount">{t("admin.coupons.dialog.maxDiscountLabel")}</Label>
                                <Input
                                    id="max_discount"
                                    type="number"
                                    min="0"
                                    value={formData.max_discount_amount || ""}
                                    onChange={(e) =>
                                        handleChange(
                                            "max_discount_amount",
                                            e.target.value ? parseFloat(e.target.value) : undefined
                                        )
                                    }
                                    placeholder={t("admin.coupons.dialog.noCap")}
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="valid_from">{t("admin.coupons.dialog.validFromLabel")}</Label>
                            <Input
                                id="valid_from"
                                type="date"
                                value={formData.valid_from || ""}
                                onChange={(e) => handleChange("valid_from", e.target.value)}
                                disabled={loading}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="valid_until">
                                {t("admin.coupons.dialog.validUntilLabel")} <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="valid_until"
                                type="date"
                                value={formData.valid_until}
                                onChange={(e) => handleChange("valid_until", e.target.value)}
                                disabled={loading}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="usage_limit">{t("admin.coupons.dialog.usageLimitLabel")}</Label>
                            <Input
                                id="usage_limit"
                                type="number"
                                min="1"
                                value={formData.usage_limit || ""}
                                onChange={(e) =>
                                    handleChange(
                                        "usage_limit",
                                        e.target.value ? parseInt(e.target.value) : undefined
                                    )
                                }
                                placeholder={t("admin.coupons.dialog.unlimited")}
                                disabled={loading}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>{t("admin.coupons.dialog.statusLabel")}</Label>
                            <Select
                                value={formData.is_active ? "active" : "inactive"}
                                onValueChange={(value) =>
                                    handleChange("is_active", value === "active")
                                }
                                disabled={loading}
                            >
                                <SelectTrigger aria-label={t("admin.coupons.dialog.typeLabel")}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent usePortal={false}>
                                    <SelectItem value="active">{t("admin.coupons.dialog.active")}</SelectItem>
                                    <SelectItem value="inactive">{t("admin.coupons.dialog.inactive")}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            {t("admin.coupons.dialog.cancel")}
                        </Button>
                        <Button type="submit" disabled={loading} className="min-w-[120px]">
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {coupon ? t("admin.coupons.dialog.updating", { defaultValue: "Updating..." }) : t("admin.coupons.dialog.creating", { defaultValue: "Creating..." })}
                                </>
                            ) : (
                                <>
                                    {coupon ? t("admin.coupons.dialog.update") : t("admin.coupons.dialog.create")} {t("admin.coupons.filters.type")}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
