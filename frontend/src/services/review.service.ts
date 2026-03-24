import { apiClient } from "@/lib/api-client";
import { Review } from "@/types";

export interface ProductReviewsResponse {
    reviews: Review[];
    total: number;
    page: number;
    totalPages: number;
    summary: {
        averageRating: number;
        totalReviews: number;
        ratingDistribution: Array<{
            stars: number;
            count: number;
            percentage: number;
        }>;
    };
}

export const reviewService = {
    // Get reviews for a product
    getProductReviews: async (productId: string, page = 1, limit = 5): Promise<ProductReviewsResponse> => {
        const response = await apiClient.get(`/reviews/product/${productId}`, {
            params: { page, limit }
        });
        return response.data;
    },

    // Get all reviews (Admin/Manager)
    getAllReviews: async (page = 1, limit = 10): Promise<{ reviews: Review[]; total: number; totalPages: number }> => {
        const response = await apiClient.get(`/reviews?page=${page}&limit=${limit}`);
        return response.data;
    },

    // Create a new review
    createReview: async (data: {
        productId: string;
        userId: string;
        rating: number;
        title: string;
        comment: string;
    }): Promise<Review> => {
        const response = await apiClient.post("/reviews", data);
        return response.data;
    },

    // Delete a review (Admin/Manager only)
    deleteReview: async (id: string): Promise<void> => {
        await apiClient.delete(`/reviews/${id}`);
    },
};
