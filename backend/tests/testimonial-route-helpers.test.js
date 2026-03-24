jest.mock('../config/supabase', () => ({
    from: jest.fn()
}));

jest.mock('../middleware/auth.middleware', () => ({
    authenticateToken: jest.fn((req, _res, next) => next()),
    requireRole: jest.fn(() => (_req, _res, next) => next()),
    checkPermission: jest.fn(() => (_req, _res, next) => next()),
    optionalAuth: jest.fn((req, _res, next) => next())
}));

const testimonialRoutes = require('../routes/testimonial.routes');

describe('Testimonial route helpers', () => {
    test('treats admins and managers as staff users', () => {
        expect(testimonialRoutes.isStaffUser({ role: 'admin' })).toBe(true);
        expect(testimonialRoutes.isStaffUser({ role: 'manager' })).toBe(true);
        expect(testimonialRoutes.isStaffUser({ role: 'customer' })).toBe(false);
        expect(testimonialRoutes.isStaffUser(null)).toBe(false);
    });

    test('requires both staff auth and isAdmin=true query for admin testimonial view', () => {
        expect(testimonialRoutes.canViewAdminTestimonials({
            query: { isAdmin: 'true' },
            user: { role: 'admin' }
        })).toBe(true);

        expect(testimonialRoutes.canViewAdminTestimonials({
            query: { isAdmin: 'true' },
            user: { role: 'manager' }
        })).toBe(true);

        expect(testimonialRoutes.canViewAdminTestimonials({
            query: { isAdmin: 'false' },
            user: { role: 'admin' }
        })).toBe(false);

        expect(testimonialRoutes.canViewAdminTestimonials({
            query: { isAdmin: 'true' },
            user: { role: 'customer' }
        })).toBe(false);

        expect(testimonialRoutes.canViewAdminTestimonials({
            query: {},
            user: { role: 'admin' }
        })).toBe(false);
    });
});
