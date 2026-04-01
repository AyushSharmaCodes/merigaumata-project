import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/contexts/CurrencyContext";

interface TransactionCardProps {
    id: string;
    date: string;
    total: number;
    idLabel?: string;
    dateLabel?: string;
    detailsLabel?: string;
    badge?: {
        label: string;
        color: string;
    };
    items?: {
        name: string;
        price: number;
        quantity?: number;
        image?: string;
    }[];
    action?: {
        label: string;
        icon?: React.ReactNode;
        onClick?: () => void;
        show?: boolean;
    };
}

export function TransactionCard({
    id,
    date,
    total,
    idLabel,
    dateLabel,
    detailsLabel,
    badge,
    items,
    action,
}: TransactionCardProps) {
    const { t, i18n } = useTranslation();
    const { formatAmount } = useCurrency();
    const [expanded, setExpanded] = useState(false);

    const displayIdLabel = idLabel || t("donate.history.orderId");
    const displayDateLabel = dateLabel || t("donate.history.date");
    const displayDetailsLabel = detailsLabel || t("donate.history.details");

    return (
        <Card className="overflow-hidden">
            <CardContent className="p-0">
                <div className="p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0 grid gap-1">
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-muted-foreground">
                                {displayIdLabel}: {id}
                            </span>
                            {badge && (
                                <Badge className={badge.color} variant="secondary">
                                    {badge.label}
                                </Badge>
                            )}
                        </div>
                        <div className="font-semibold">{displayDetailsLabel}</div>
                        <div className="text-sm text-muted-foreground">
                            {displayDateLabel}: {new Date(date).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                    </div>

                    <div className="text-right">
                        <div className="font-bold text-lg">{formatAmount(total)}</div>
                        {action?.show && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-2 h-8"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    action.onClick?.();
                                }}
                            >
                                {action.icon}
                                {action.label}
                            </Button>
                        )}
                    </div>
                </div>

                {items && items.length > 0 && (
                    <div className="border-t bg-muted/30">
                        <Button
                            variant="ghost"
                            className="w-full justify-between rounded-none h-auto py-2 px-4 text-xs text-muted-foreground hover:bg-muted/50"
                            onClick={() => setExpanded(!expanded)}
                        >
                            <span>
                                {items.length} {items.length === 1 ? t("donate.history.item") : t("donate.history.items")}
                            </span>
                            {expanded ? (
                                <ChevronUp className="h-3 w-3" />
                            ) : (
                                <ChevronDown className="h-3 w-3" />
                            )}
                        </Button>

                        {expanded && (
                            <div className="p-4 space-y-3 border-t">
                                {items.map((item, index) => (
                                    <div key={index} className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">{item.name}</span>
                                        <span className="font-medium">{formatAmount(item.price)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
