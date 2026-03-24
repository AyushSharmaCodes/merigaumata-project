const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateToken, checkPermission, optionalAuth } = require('../middleware/auth.middleware');

// Middleware to check if user is admin (reused from other routes logic if available, or just check role)
// For now, we'll assume the frontend sends the user ID/role and we verify it, 
// or we rely on RLS if we were using the supabase client directly with auth.
// Since we are using the service role client in 'config/supabase', we bypass RLS, 
// so we MUST verify admin status here if we want security.
// However, for this project context, we often skip strict auth middleware in these snippets 
// unless explicitly required, but I should add a basic check or comment.
// I'll check how other routes handle it. `social-media.routes.js` checks `isAdmin` query param or body?
// Let's look at `social-media.routes.js` pattern.


// GET /api/contact-info - Fetch all contact info (public)
router.get('/', optionalAuth, async (req, res) => {
    try {
        // Fetch address
        const { data: addressData, error: addressError } = await supabase
            .from('contact_info')
            .select('*')
            .single();

        // Apply Address i18n Overlay
        if (addressData) {
            const lang = req.language || req.query.lang || 'en';
            if (addressData.address_line1_i18n && addressData.address_line1_i18n[lang]) addressData.address_line1 = addressData.address_line1_i18n[lang];
            if (addressData.address_line2_i18n && addressData.address_line2_i18n[lang]) addressData.address_line2 = addressData.address_line2_i18n[lang];
            if (addressData.city_i18n && addressData.city_i18n[lang]) addressData.city = addressData.city_i18n[lang];
            if (addressData.state_i18n && addressData.state_i18n[lang]) addressData.state = addressData.state_i18n[lang];
            if (addressData.country_i18n && addressData.country_i18n[lang]) addressData.country = addressData.country_i18n[lang];
        }

        // Fetch active phones (or all if admin)
        const isAdmin = req.query.isAdmin === 'true'
            && req.user
            && (req.user.role === 'admin' || req.user.role === 'manager');
        let phonesQuery = supabase.from('contact_phones').select('*').order('display_order', { ascending: true });
        if (!isAdmin) {
            phonesQuery = phonesQuery.eq('is_active', true);
        }
        const { data: phonesData, error: phonesError } = await phonesQuery;

        // Apply Phones i18n Overlay
        const lang = req.language || req.query.lang || 'en';
        if (phonesData) {
            phonesData.forEach(phone => {
                if (phone.label_i18n && phone.label_i18n[lang]) {
                    phone.label = phone.label_i18n[lang];
                }
            });
        }

        // Fetch active emails (or all if admin)
        let emailsQuery = supabase.from('contact_emails').select('*').order('display_order', { ascending: true });
        if (!isAdmin) {
            emailsQuery = emailsQuery.eq('is_active', true);
        }
        const { data: emailsData, error: emailsError } = await emailsQuery;

        // Apply Emails i18n Overlay
        if (emailsData) {
            emailsData.forEach(email => {
                if (email.label_i18n && email.label_i18n[lang]) {
                    email.label = email.label_i18n[lang];
                }
            });
        }

        // Fetch office hours
        const { data: officeHoursData, error: officeHoursError } = await supabase
            .from('contact_office_hours')
            .select('*')
            .order('display_order', { ascending: true });

        if (addressError && addressError.code !== 'PGRST116') { // PGRST116 is "Row not found"
            throw addressError;
        }

        res.json({
            address: addressData || {},
            phones: phonesData || [],
            emails: emailsData || [],
            officeHours: officeHoursData || []
        });
    } catch (error) {
        logger.error({ err: error }, 'Error fetching contact info:');
        res.status(500).json({ error: req.t('errors.contactInfo.fetchFailed') });
    }
});

// PUT /api/contact-info/address - Update address (admin only)
router.put('/address', authenticateToken, checkPermission('can_manage_contact_info'), async (req, res) => {
    try {
        const {
            address_line1, address_line2, city, state, pincode, country, google_maps_link,
            address_line1_i18n, address_line2_i18n, city_i18n, state_i18n, country_i18n
        } = req.body;

        // Check if row exists
        const { data: existing } = await supabase.from('contact_info').select('id').single();

        let result;
        const updateData = {
            address_line1, address_line2, city, state, pincode, country, google_maps_link,
            address_line1_i18n, address_line2_i18n, city_i18n, state_i18n, country_i18n,
            updated_at: new Date()
        };

        if (existing) {
            result = await supabase
                .from('contact_info')
                .update(updateData)
                .eq('id', existing.id)
                .select()
                .single();
        } else {
            result = await supabase
                .from('contact_info')
                .insert([updateData])
                .select()
                .single();
        }

        if (result.error) throw result.error;
        res.json(result.data);
    } catch (error) {
        logger.error({ err: error }, 'Error updating address:');
        res.status(500).json({ error: req.t('errors.contactInfo.updateAddressFailed') });
    }
});

// --- PHONES ---

// POST /api/contact-info/phones - Add phone
router.post('/phones', authenticateToken, checkPermission('can_manage_contact_info'), async (req, res) => {
    try {
        const { number, label, label_i18n, is_primary, display_order } = req.body;
        const { data, error } = await supabase
            .from('contact_phones')
            .insert([{
                number,
                label,
                label_i18n: label_i18n || { en: label },
                is_primary,
                display_order
            }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        logger.error({ err: error }, 'Error adding phone:');
        res.status(500).json({ error: req.t('errors.contactInfo.addPhoneFailed') });
    }
});

// PUT /api/contact-info/phones/:id - Update phone
router.put('/phones/:id', authenticateToken, checkPermission('can_manage_contact_info'), async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const { data, error } = await supabase
            .from('contact_phones')
            .update({ ...updates, updated_at: new Date() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        logger.error({ err: error }, 'Error updating phone:');
        res.status(500).json({ error: req.t('errors.contactInfo.updatePhoneFailed') });
    }
});

// DELETE /api/contact-info/phones/:id - Delete phone
router.delete('/phones/:id', authenticateToken, checkPermission('can_manage_contact_info'), async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('contact_phones')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ message: req.t('success.contactInfo.phoneDeleted') });
    } catch (error) {
        logger.error({ err: error }, 'Error deleting phone:');
        res.status(500).json({ error: req.t('errors.contactInfo.deletePhoneFailed') });
    }
});

// --- EMAILS ---

// POST /api/contact-info/emails - Add email
router.post('/emails', authenticateToken, checkPermission('can_manage_contact_info'), async (req, res) => {
    try {
        const { email, label, label_i18n, is_primary, display_order } = req.body;
        const { data, error } = await supabase
            .from('contact_emails')
            .insert([{
                email,
                label,
                label_i18n: label_i18n || { en: label },
                is_primary,
                display_order
            }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        logger.error({ err: error }, 'Error adding email:');
        res.status(500).json({ error: req.t('errors.contactInfo.addEmailFailed') });
    }
});

// PUT /api/contact-info/emails/:id - Update email
router.put('/emails/:id', authenticateToken, checkPermission('can_manage_contact_info'), async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const { data, error } = await supabase
            .from('contact_emails')
            .update({ ...updates, updated_at: new Date() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        logger.error({ err: error }, 'Error updating email:');
        res.status(500).json({ error: req.t('errors.contactInfo.updateEmailFailed') });
    }
});

// DELETE /api/contact-info/emails/:id - Delete email
router.delete('/emails/:id', authenticateToken, checkPermission('can_manage_contact_info'), async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('contact_emails')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ message: req.t('success.contactInfo.emailDeleted') });
    } catch (error) {
        logger.error({ err: error }, 'Error deleting email:');
        res.status(500).json({ error: req.t('errors.contactInfo.deleteEmailFailed') });
    }
});

// --- OFFICE HOURS ---

// POST /api/contact-info/office-hours - Add office hours
router.post('/office-hours', authenticateToken, checkPermission('can_manage_contact_info'), async (req, res) => {
    try {
        const { day_of_week, open_time, close_time, is_closed, display_order } = req.body;
        const { data, error } = await supabase
            .from('contact_office_hours')
            .insert([{ day_of_week, open_time, close_time, is_closed, display_order }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        logger.error({ err: error }, 'Error adding office hours:');
        res.status(500).json({ error: req.t('errors.contactInfo.addOfficeHoursFailed') });
    }
});

// PUT /api/contact-info/office-hours/:id - Update office hours
router.put('/office-hours/:id', authenticateToken, checkPermission('can_manage_contact_info'), async (req, res) => {
    try {
        const { id } = req.params;
        const { day_of_week, open_time, close_time, is_closed, display_order } = req.body;

        logger.debug({ officeHoursId: id }, 'Updating office hours');

        const updateData = { updated_at: new Date() };
        if (day_of_week !== undefined) updateData.day_of_week = day_of_week;
        if (open_time !== undefined) updateData.open_time = open_time;
        if (close_time !== undefined) updateData.close_time = close_time;
        if (is_closed !== undefined) updateData.is_closed = is_closed;
        if (display_order !== undefined) updateData.display_order = display_order;

        const { data, error } = await supabase
            .from('contact_office_hours')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            logger.error({ err: error }, '[OfficeHours] Supabase Error:');
            throw error;
        }

        logger.info({ officeHoursId: id }, 'Office hours updated');
        res.json(data);
    } catch (error) {
        logger.error({ err: error }, 'Error updating office hours:');
        res.status(500).json({ error: req.t('errors.contactInfo.updateOfficeHoursFailed') });
    }
});

// DELETE /api/contact-info/office-hours/:id - Delete office hours
router.delete('/office-hours/:id', authenticateToken, checkPermission('can_manage_contact_info'), async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('contact_office_hours')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ message: req.t('success.contactInfo.officeHoursDeleted') });
    } catch (error) {
        logger.error({ err: error }, 'Error deleting office hours:');
        res.status(500).json({ error: req.t('errors.contactInfo.deleteOfficeHoursFailed') });
    }
});

module.exports = router;
