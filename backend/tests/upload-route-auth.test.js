jest.mock('../config/supabase', () => ({
    supabase: {},
    supabaseAdmin: {
        from: jest.fn()
    }
}));

const { supabaseAdmin } = require('../config/supabase');
const uploadRoutes = require('../routes/upload.routes');

describe('Upload route authorization helpers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('allows admins to manage any upload type', async () => {
        await expect(uploadRoutes.canManageUploadType({ id: 'admin-1', role: 'admin' }, 'product')).resolves.toBe(true);
        await expect(uploadRoutes.canManageUploadType({ id: 'admin-1', role: 'admin' }, 'gallery')).resolves.toBe(true);
        await expect(uploadRoutes.canManageUploadType({ id: 'admin-1', role: 'admin' }, 'return')).resolves.toBe(true);
        expect(supabaseAdmin.from).not.toHaveBeenCalled();
    });

    test('allows authenticated users to upload profile/testimonial images without manager permissions', async () => {
        await expect(uploadRoutes.canManageUploadType({ id: 'user-1', role: 'customer' }, 'profile')).resolves.toBe(true);
        await expect(uploadRoutes.canManageUploadType({ id: 'user-1', role: 'customer' }, 'testimonial')).resolves.toBe(true);
        await expect(uploadRoutes.canManageUploadType({ id: 'user-1', role: 'customer' }, 'return')).resolves.toBe(true);
        await expect(uploadRoutes.canManageUploadType({ id: 'user-1', role: 'customer' }, 'return_order')).resolves.toBe(true);
    });

    test('requires matching manager permission for managed upload types', async () => {
        const mockSingle = jest.fn().mockResolvedValue({
            data: {
                is_active: true,
                can_manage_gallery: true
            },
            error: null
        });
        const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
        const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
        supabaseAdmin.from.mockReturnValue({ select: mockSelect });

        await expect(uploadRoutes.canManageUploadType({ id: 'manager-1', role: 'manager' }, 'gallery')).resolves.toBe(true);
        await expect(uploadRoutes.canManageUploadType({ id: 'manager-1', role: 'manager' }, 'product')).resolves.toBe(false);
    });

    test('restricts bucket deletes to matching manager module', () => {
        const req = {
            user: { id: 'manager-1', role: 'manager' },
            managerPermissions: {
                is_active: true,
                can_manage_gallery: true,
                can_manage_about_us: false,
                can_manage_events: false,
                can_manage_blogs: false,
                can_manage_testimonials: false,
                can_manage_products: false,
                can_manage_carousel: true
            }
        };

        expect(uploadRoutes.hasBucketPermission(req, 'gallery', 'folder/file.jpg')).toBe(true);
        expect(uploadRoutes.hasBucketPermission(req, 'team', 'member.jpg')).toBe(false);
        expect(uploadRoutes.hasBucketPermission(req, 'images', 'carousel/banner.jpg')).toBe(true);
        expect(uploadRoutes.hasBucketPermission(req, 'images', 'products/item.jpg')).toBe(false);
        expect(uploadRoutes.hasBucketPermission(req, 'profiles', 'manager-1/avatar.png')).toBe(true);
        expect(uploadRoutes.hasBucketPermission(req, 'profiles', 'other-user/avatar.png')).toBe(false);
    });

    test('photo metadata fallback succeeds when legacy schemas reject richer payloads', async () => {
        const mockSingle = jest
            .fn()
            .mockResolvedValueOnce({
                data: null,
                error: { message: 'column "bucket_name" does not exist' }
            })
            .mockResolvedValueOnce({
                data: {
                    id: 'photo-1',
                    image_path: 'products/item.jpg'
                },
                error: null
            });

        const mockInsert = jest.fn(() => ({
            select: jest.fn(() => ({
                single: mockSingle
            }))
        }));

        supabaseAdmin.from.mockReturnValue({
            insert: mockInsert
        });

        const result = await uploadRoutes.insertPhotoMetadataWithFallback({
            imagePath: 'products/item.jpg',
            bucketName: 'images',
            title: 'item.jpg',
            size: 1234,
            mimeType: 'image/jpeg',
            userId: 'user-1'
        });

        expect(result.error).toBeNull();
        expect(result.data?.id).toBe('photo-1');
        expect(mockInsert).toHaveBeenCalledTimes(2);
    });
});
