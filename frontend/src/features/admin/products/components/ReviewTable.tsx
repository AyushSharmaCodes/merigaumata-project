import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/shared/components/ui/table";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Star, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Review } from "@/shared/types";

interface ReviewTableProps {
    reviews: Review[];
    onDelete: (id: string) => void;
}

export const ReviewTable = ({ reviews, onDelete }: ReviewTableProps) => {
    const { t } = useTranslation();

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>{t("admin.reviews.table.product")}</TableHead>
                    <TableHead>{t("admin.reviews.table.user")}</TableHead>
                    <TableHead>{t("admin.reviews.table.rating")}</TableHead>
                    <TableHead>{t("admin.reviews.table.review")}</TableHead>
                    <TableHead>{t("admin.reviews.table.date")}</TableHead>
                    <TableHead className="text-right">{t("admin.reviews.table.actions")}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {reviews.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8">{t("admin.reviews.empty")}</TableCell></TableRow>
                ) : (
                    reviews.map((review) => (
                        <TableRow key={review.id}>
                            <TableCell className="font-medium">{review.productName || t("admin.reviews.table.unknownProduct")}</TableCell>
                            <TableCell>
                                <div className="flex flex-col">
                                    <span>{review.userName}</span>
                                    {review.verified && <Badge variant="secondary" className="w-fit text-[10px] px-1 py-0">{t("admin.reviews.table.verified")}</Badge>}
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-1.5 bg-[#D4AF37]/5 px-2 py-1 rounded-md border border-[#D4AF37]/10">
                                    <Star className="h-4 w-4 fill-[#D4AF37] text-[#D4AF37] drop-shadow-[0_0_4px_rgba(212,175,55,0.2)]" />
                                    <span className="font-bold text-[#2C1810]">{review.rating}</span>
                                </div>
                            </TableCell>
                            <TableCell className="max-w-md">
                                <div className="font-medium truncate">{review.title}</div>
                                <div className="text-sm text-muted-foreground truncate">{review.comment}</div>
                            </TableCell>
                            <TableCell>{new Date(review.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                                <Button
                                    variant="ghost" size="icon" onClick={() => onDelete(review.id)}
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
        </Table>
    );
};
