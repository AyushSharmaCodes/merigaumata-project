import { CartResponse, CartItem, Product } from "@/types";

export class CartDTO {
    /**
     * transforms Backend Cart Response to Frontend Cart Item List
     */
    static toCartItems(response: CartResponse): CartItem[] {
        if (!response?.cart?.cart_items) {
            return [];
        }

        const itemBreakdown = response.totals?.itemBreakdown || [];

        return response.cart.cart_items.map((item) => {
            const itemDetail = itemBreakdown.find((id: any) =>
                (id.variant_id && id.variant_id === item.variant_id) ||
                (!id.variant_id && id.product_id === item.product_id)
            );

            return {
                productId: item.product_id,
                quantity: item.quantity,
                product: item.products,
                variantId: item.variant_id || undefined,
                variant: item.product_variants,
                delivery_charge: itemDetail?.delivery_charge ?? 0,
                delivery_gst: itemDetail?.delivery_gst ?? 0,
                delivery_meta: itemDetail?.delivery_meta,
                coupon_discount: itemDetail?.coupon_discount ?? 0,
                coupon_code: itemDetail?.coupon_code ?? '',
                tax_breakdown: itemDetail?.tax_breakdown
            };
        });
    }

    /**
     * transforms Backend Cart Response to Frontend Cart structure (items + totals)
     * if needed for state updates
     */
    static fromResponse(response: CartResponse): { items: CartItem[], totals: CartResponse['totals'], deliverySettings?: CartResponse['totals']['deliverySettings'] } {
        return {
            items: this.toCartItems(response),
            totals: response.totals,
            deliverySettings: response.totals.deliverySettings
        };
    }
}
