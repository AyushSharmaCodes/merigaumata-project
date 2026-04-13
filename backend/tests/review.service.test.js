const ReviewService = require('../services/review.service');
const supabase = require('../lib/supabase');

jest.mock('../lib/supabase', () => ({
    from: jest.fn()
}));

jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
}));

function createQueryBuilder({ onMaybeSingle, onSingle, onLimit, onRange, onThen, onUpdate } = {}) {
    const state = {
        filters: {},
        orderArgs: []
    };

    const builder = {
        select: jest.fn(() => builder),
        eq: jest.fn((column, value) => {
            state.filters[column] = value;
            return builder;
        }),
        order: jest.fn((column, options) => {
            state.orderArgs.push([column, options]);
            return builder;
        }),
        limit: jest.fn(() => Promise.resolve(onLimit ? onLimit(state) : { data: [], error: null })),
        range: jest.fn((from, to) => Promise.resolve(onRange ? onRange(state, from, to) : { data: [], count: 0, error: null })),
        insert: jest.fn(() => builder),
        update: jest.fn((payload) => {
            state.updatePayload = payload;
            return onUpdate ? onUpdate(state, payload) : builder;
        }),
        delete: jest.fn(() => builder),
        maybeSingle: jest.fn(() => Promise.resolve(onMaybeSingle ? onMaybeSingle(state) : { data: null, error: null })),
        single: jest.fn(() => Promise.resolve(onSingle ? onSingle(state) : { data: null, error: null })),
        then(resolve, reject) {
            return Promise.resolve(onThen ? onThen(state) : { data: [], error: null }).then(resolve, reject);
        }
    };

    return builder;
}

describe('ReviewService', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('getProductReviews computes summary from live review counts', async () => {
        const reviewsBuilder = createQueryBuilder({
            onRange: () => ({
                data: [
                    {
                        id: 'review-1',
                        product_id: 'product-1',
                        user_id: 'user-1',
                        rating: 5,
                        title: 'Great',
                        comment: 'Loved it a lot',
                        is_verified: true,
                        created_at: '2026-03-28T10:00:00.000Z',
                        profiles: { name: 'Asha', avatar_url: null }
                    }
                ],
                count: 3,
                error: null
            })
        });

        const productBuilder = createQueryBuilder({
            onMaybeSingle: () => ({ data: { id: 'product-1' }, error: null })
        });

        const distributionBuilders = {
            1: createQueryBuilder({ onThen: () => ({ count: 0, error: null }) }),
            2: createQueryBuilder({ onThen: () => ({ count: 1, error: null }) }),
            3: createQueryBuilder({ onThen: () => ({ count: 0, error: null }) }),
            4: createQueryBuilder({ onThen: () => ({ count: 1, error: null }) }),
            5: createQueryBuilder({ onThen: () => ({ count: 1, error: null }) })
        };

        let reviewSelectCount = 0;
        supabase.from.mockImplementation((table) => {
            if (table === 'products') {
                return productBuilder;
            }

            if (table !== 'reviews') {
                throw new Error(`Unexpected table ${table}`);
            }

            reviewSelectCount += 1;
            if (reviewSelectCount === 1) {
                return reviewsBuilder;
            }

            return distributionBuilders[reviewSelectCount - 1];
        });

        const result = await ReviewService.getProductReviews('product-1', { page: 1, limit: 5 });

        expect(result.total).toBe(3);
        expect(result.summary.totalReviews).toBe(3);
        expect(result.summary.averageRating).toBe(3.7);
        expect(result.summary.ratingDistribution).toHaveLength(5);
        expect(result.summary.ratingDistribution[0]).toMatchObject({ stars: 5, count: 1 });
        expect(result.summary.ratingDistribution[1]).toMatchObject({ stars: 4, count: 1 });
        expect(result.summary.ratingDistribution[2]).toMatchObject({ stars: 3, count: 0, percentage: 0 });
        expect(result.summary.ratingDistribution[3]).toMatchObject({ stars: 2, count: 1 });
        expect(result.summary.ratingDistribution[4]).toMatchObject({ stars: 1, count: 0, percentage: 0 });
        expect(result.summary.ratingDistribution[0].percentage).toBeCloseTo(100 / 3);
        expect(result.summary.ratingDistribution[1].percentage).toBeCloseTo(100 / 3);
        expect(result.summary.ratingDistribution[3].percentage).toBeCloseTo(100 / 3);
    });

    test('createReview marks review verified when delivered order_items contain the product', async () => {
        const productBuilder = createQueryBuilder({
            onMaybeSingle: () => ({ data: { id: 'product-1' }, error: null })
        });
        const existingReviewBuilder = createQueryBuilder({
            onMaybeSingle: () => ({ data: null, error: null })
        });
        const ordersBuilder = createQueryBuilder({
            onLimit: () => ({
                data: [
                    {
                        id: 'order-1',
                        items: [],
                        order_items: [{ product_id: 'product-1' }]
                    }
                ],
                error: null
            })
        });
        let insertedPayload;
        const insertBuilder = createQueryBuilder({
            onSingle: (state) => ({
                data: {
                    id: 'review-1',
                    ...state.insertedPayload
                },
                error: null
            })
        });
        insertBuilder.insert = jest.fn((payload) => {
            insertedPayload = payload[0];
            insertBuilder.insertedPayload = payload[0];
            return insertBuilder;
        });
        const aggregationSelectBuilder = createQueryBuilder({
            onThen: () => ({
                data: [{ rating: 5 }],
                error: null
            })
        });
        const productUpdateBuilder = createQueryBuilder();

        supabase.from.mockImplementation((table) => {
            if (table === 'products') {
                if (!productUpdateBuilder.update.mock.calls.length && productBuilder.maybeSingle.mock.calls.length === 0) {
                    return productBuilder;
                }
                return productUpdateBuilder;
            }

            if (table === 'orders') {
                return ordersBuilder;
            }

            if (table !== 'reviews') {
                throw new Error(`Unexpected table ${table}`);
            }

            if (existingReviewBuilder.maybeSingle.mock.calls.length === 0) {
                return existingReviewBuilder;
            }

            if (!insertBuilder.insert.mock.calls.length) {
                return insertBuilder;
            }

            return aggregationSelectBuilder;
        });

        await ReviewService.createReview({
            productId: 'product-1',
            userId: 'user-1',
            rating: 5,
            title: 'Excellent',
            comment: 'This is a truly excellent product.'
        });

        expect(insertedPayload).toMatchObject({
            product_id: 'product-1',
            user_id: 'user-1',
            is_verified: true
        });
    });

    test('createReview converts unique violations into already reviewed errors', async () => {
        const productBuilder = createQueryBuilder({
            onMaybeSingle: () => ({ data: { id: 'product-1' }, error: null })
        });
        const existingReviewBuilder = createQueryBuilder({
            onMaybeSingle: () => ({ data: null, error: null })
        });
        const ordersBuilder = createQueryBuilder({
            onLimit: () => ({ data: [], error: null })
        });
        const insertBuilder = createQueryBuilder({
            onSingle: () => ({
                data: null,
                error: {
                    code: '23505',
                    message: 'duplicate key value violates unique constraint "idx_reviews_product_user_unique" on review'
                }
            })
        });

        supabase.from.mockImplementation((table) => {
            if (table === 'products') {
                return productBuilder;
            }

            if (table === 'orders') {
                return ordersBuilder;
            }

            if (table !== 'reviews') {
                throw new Error(`Unexpected table ${table}`);
            }

            if (existingReviewBuilder.maybeSingle.mock.calls.length === 0) {
                return existingReviewBuilder;
            }

            return insertBuilder;
        });

        await expect(ReviewService.createReview({
            productId: 'product-1',
            userId: 'user-1',
            rating: 5,
            title: 'Excellent',
            comment: 'This is a truly excellent product.'
        })).rejects.toMatchObject({
            message: 'errors.review.alreadyReviewed',
            status: 400
        });
    });

    test('deleteReview returns a not found error when review is missing', async () => {
        const fetchBuilder = createQueryBuilder({
            onMaybeSingle: () => ({ data: null, error: null })
        });

        supabase.from.mockImplementation((table) => {
            if (table !== 'reviews') {
                throw new Error(`Unexpected table ${table}`);
            }

            return fetchBuilder;
        });

        await expect(ReviewService.deleteReview('missing-review')).rejects.toMatchObject({
            message: 'errors.review.notFound',
            status: 404
        });
    });
});
