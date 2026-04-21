jest.mock('../config/supabase', () => ({
    from: jest.fn()
}));

jest.mock('pdf-parse', () => jest.fn());
jest.mock('mammoth', () => ({ convertToHtml: jest.fn() }));
jest.mock('isomorphic-dompurify', () => ({ sanitize: (html) => html }));

const supabase = require('../config/supabase');
const policyService = require('../services/policy.service');

function buildQuery(result) {
    const chain = {
        select: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        order: jest.fn(() => chain),
        limit: jest.fn(() => chain),
        maybeSingle: jest.fn().mockResolvedValue(result)
    };

    return chain;
}

describe('PolicyService.getActivePolicy', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('returns null when no active policy exists', async () => {
        supabase.from.mockReturnValue(buildQuery({
            data: null,
            error: { code: 'PGRST116', message: 'No rows found' }
        }));

        await expect(policyService.getActivePolicy('privacy')).resolves.toBeNull();
    });

    test('falls back to legacy policy_pages columns when modern schema is unavailable', async () => {
        supabase.from
            .mockReturnValueOnce(buildQuery({
                data: null,
                error: { code: '42703', message: 'column "policy_type" does not exist' }
            }))
            .mockReturnValueOnce(buildQuery({
                data: {
                    type: 'privacy',
                    title: 'Privacy Policy',
                    content: '<p>Legacy content</p>',
                    title_i18n: { en: 'Privacy Policy', hi: 'गोपनीयता नीति' },
                    content_i18n: { en: '<p>Legacy content</p>', hi: '<p>पुरानी सामग्री</p>' },
                    is_active: true,
                    updated_at: '2026-04-19T00:00:00.000Z'
                },
                error: null
            }));

        await expect(policyService.getActivePolicy('privacy', 'hi')).resolves.toEqual(
            expect.objectContaining({
                policy_type: 'privacy',
                title: 'गोपनीयता नीति',
                content_html: '<p>पुरानी सामग्री</p>',
                version: 1
            })
        );
    });
});
