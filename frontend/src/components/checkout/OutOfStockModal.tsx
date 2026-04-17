import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ShoppingCart, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckoutMessages } from "@/constants/messages/CheckoutMessages";
import { CommonMessages } from "@/constants/messages/CommonMessages";

interface StockIssue {
    productId: string;
    variantId: string | null;
    title: string;
    variantLabel: string | null;
    requestedQty: number;
    availableStock: number;
    image: string | null;
}

interface OutOfStockModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    stockIssues: StockIssue[];
    onRemoveItem?: (productId: string, variantId: string | null) => void;
}

export function OutOfStockModal({
    open,
    onOpenChange,
    stockIssues,
    onRemoveItem,
}: OutOfStockModalProps) {
    const { t } = useTranslation();
    if (stockIssues.length === 0) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-5 w-5" />
                        {t(CheckoutMessages.STOCK_UNAVAILABLE)}
                    </DialogTitle>
                    <DialogDescription>
                        {t(CheckoutMessages.STOCK_DESC)}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 max-h-[300px] overflow-y-auto py-2">
                    {stockIssues.map((item) => (
                        <div
                            key={`${item.productId}-${item.variantId || 'default'}`}
                            className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-destructive/20"
                        >
                            {item.image && (
                                <img
                                    src={item.image}
                                    alt={item.title}
                                    className="w-12 h-12 object-cover rounded"
                                />
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{item.title}</p>
                                {item.variantLabel && (
                                    <p className="text-xs text-muted-foreground">{item.variantLabel}</p>
                                )}
                                <p className="text-xs text-destructive mt-1">
                                    {item.availableStock === 0 ? (
                                        t(CheckoutMessages.OUT_OF_STOCK)
                                    ) : (
                                        <>
                                            {t(CheckoutMessages.ONLY_AVAILABLE, { count: item.availableStock })}
                                            {" "}({t(CheckoutMessages.YOU_REQUESTED, { count: item.requestedQty })})
                                        </>
                                    )}
                                </p>
                            </div>
                            {onRemoveItem && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => onRemoveItem(item.productId, item.variantId)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    ))}
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-col">
                    <Button asChild className="w-full">
                        <Link to="/cart">
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            {t(CheckoutMessages.UPDATE_CART)}
                        </Link>
                    </Button>
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
                        {t(CommonMessages.CANCEL)}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
