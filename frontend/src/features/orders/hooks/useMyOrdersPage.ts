import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { orderService } from "@/domains/order";

export const useMyOrdersPage = () => {
    const [currentPage, setCurrentPage] = useState(1);

    // Filter States
    const [searchQuery, setSearchQuery] = useState("");
    const debouncedSearch = useDebounce(searchQuery, 500);
    const [statusFilter, setStatusFilter] = useState("all");
    const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });

    // Use Query for optimized fetching
    const { data, isLoading: loading, error } = useQuery({
        queryKey: ['my-orders', currentPage, debouncedSearch, statusFilter, paymentStatusFilter, dateRange],
        queryFn: async () => {
            const response = await orderService.getMyOrders({
                page: currentPage,
                limit: 10,
                orderNumber: debouncedSearch,
                status: statusFilter === "all" ? undefined : statusFilter,
                payment_status: paymentStatusFilter === "all" ? undefined : paymentStatusFilter,
                startDate: dateRange.start || undefined,
                endDate: dateRange.end || undefined
            });
            return response;
        },
        placeholderData: (previousData) => previousData, // Maintain UI during pagination
    });

    const orders = data?.data || [];
    const meta = data?.meta || { page: 1, limit: 10, total: 0, totalPages: 1 };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= meta.totalPages) {
            setCurrentPage(newPage);
        }
    };

    const clearFilters = () => {
        setSearchQuery("");
        setStatusFilter("all");
        setPaymentStatusFilter("all");
        setDateRange({ start: "", end: "" });
        setCurrentPage(1);
    };

    return {
        orders,
        meta,
        loading,
        error,
        currentPage,
        searchQuery,
        setSearchQuery,
        statusFilter,
        setStatusFilter,
        paymentStatusFilter,
        setPaymentStatusFilter,
        dateRange,
        setDateRange,
        handlePageChange,
        clearFilters,
    };
};
