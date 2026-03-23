-- ==========================================
-- RLS Policy Performance Optimization Migration
-- Fixes auth_rls_initplan warnings by wrapping auth functions with (select ...)
-- Created: 2026-01-14
-- ==========================================

-- This migration drops and recreates RLS policies that use auth.uid(), auth.jwt(), 
-- or current_setting() directly, replacing them with (select ...) wrapped versions.
-- This ensures the auth function is evaluated once per query, not per row.

BEGIN;

-- ==========================================
-- PHOTOS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Allow update own" ON public.photos;
DROP POLICY IF EXISTS "Allow delete own" ON public.photos;

CREATE POLICY "Allow update own" ON public.photos
FOR UPDATE USING (user_id = (select auth.uid()));

CREATE POLICY "Allow delete own" ON public.photos
FOR DELETE USING (user_id = (select auth.uid()));

-- ==========================================
-- BLOGS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Authenticated users can manage blogs" ON public.blogs;

CREATE POLICY "Authenticated users can manage blogs" ON public.blogs
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = (select auth.uid())
        AND r.name IN ('admin', 'manager')
    )
);

-- ==========================================
-- COMMENT_MODERATION_LOG TABLE
-- ==========================================
DROP POLICY IF EXISTS "Admins can view moderation logs" ON public.comment_moderation_log;

CREATE POLICY "Admins can view moderation logs" ON public.comment_moderation_log
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = (select auth.uid())
        AND r.name IN ('admin', 'manager')
    )
);

-- ==========================================
-- PROFILES TABLE
-- ==========================================
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own data" ON public.profiles;

CREATE POLICY "Users can insert their own profile" ON public.profiles
FOR INSERT WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE USING ((select auth.uid()) = id);

CREATE POLICY "Users can read own data" ON public.profiles
FOR SELECT USING ((select auth.uid()) = id);

-- ==========================================
-- TESTIMONIALS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Users can view their own testimonials" ON public.testimonials;
DROP POLICY IF EXISTS "Authenticated users can create testimonials" ON public.testimonials;
DROP POLICY IF EXISTS "Users can update their own testimonials" ON public.testimonials;
DROP POLICY IF EXISTS "Users can delete their own testimonials" ON public.testimonials;

CREATE POLICY "Users can view their own testimonials" ON public.testimonials
FOR SELECT USING (user_id = (select auth.uid()));

CREATE POLICY "Authenticated users can create testimonials" ON public.testimonials
FOR INSERT WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update their own testimonials" ON public.testimonials
FOR UPDATE USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete their own testimonials" ON public.testimonials
FOR DELETE USING (user_id = (select auth.uid()));

-- ==========================================
-- MANAGER_PERMISSIONS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Managers can view their own permissions" ON public.manager_permissions;

CREATE POLICY "Managers can view their own permissions" ON public.manager_permissions
FOR SELECT USING (user_id = (select auth.uid()));

-- ==========================================
-- REVIEWS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Authenticated users can create reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can update their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can delete their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Admins and Managers can delete any review" ON public.reviews;

CREATE POLICY "Authenticated users can create reviews" ON public.reviews
FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Users can update their own reviews" ON public.reviews
FOR UPDATE USING (user_id = (select auth.uid()));

CREATE POLICY "Users can delete their own reviews" ON public.reviews
FOR DELETE USING (user_id = (select auth.uid()));

CREATE POLICY "Admins and Managers can delete any review" ON public.reviews
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = (select auth.uid())
        AND r.name IN ('admin', 'manager')
    )
);

-- ==========================================
-- BLOG_COMMENTS_BACKUP TABLE
-- ==========================================
DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.blog_comments_backup;
DROP POLICY IF EXISTS "Users can update their own comments" ON public.blog_comments_backup;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.blog_comments_backup;

CREATE POLICY "Authenticated users can create comments" ON public.blog_comments_backup
FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Users can update their own comments" ON public.blog_comments_backup
FOR UPDATE USING (user_id = (select auth.uid()));

CREATE POLICY "Users can delete their own comments" ON public.blog_comments_backup
FOR DELETE USING (user_id = (select auth.uid()));

-- ==========================================
-- ABOUT_* TABLES (Admin full access policies)
-- ==========================================
-- about_cards
DROP POLICY IF EXISTS "Admin full access" ON public.about_cards;
CREATE POLICY "Admin full access" ON public.about_cards
FOR ALL TO authenticated
USING ((select auth.jwt()) ->> 'role' = 'admin');

-- about_impact_stats
DROP POLICY IF EXISTS "Admin full access" ON public.about_impact_stats;
CREATE POLICY "Admin full access" ON public.about_impact_stats
FOR ALL TO authenticated
USING ((select auth.jwt()) ->> 'role' = 'admin');

-- about_timeline
DROP POLICY IF EXISTS "Admin full access" ON public.about_timeline;
CREATE POLICY "Admin full access" ON public.about_timeline
FOR ALL TO authenticated
USING ((select auth.jwt()) ->> 'role' = 'admin');

-- about_team_members
DROP POLICY IF EXISTS "Admin full access" ON public.about_team_members;
CREATE POLICY "Admin full access" ON public.about_team_members
FOR ALL TO authenticated
USING ((select auth.jwt()) ->> 'role' = 'admin');

-- about_future_goals
DROP POLICY IF EXISTS "Admin full access" ON public.about_future_goals;
CREATE POLICY "Admin full access" ON public.about_future_goals
FOR ALL TO authenticated
USING ((select auth.jwt()) ->> 'role' = 'admin');

-- about_settings
DROP POLICY IF EXISTS "Admin full access" ON public.about_settings;
CREATE POLICY "Admin full access" ON public.about_settings
FOR ALL TO authenticated
USING ((select auth.jwt()) ->> 'role' = 'admin');

-- ==========================================
-- COMMENTS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Admins can view all comments" ON public.comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON public.comments;
DROP POLICY IF EXISTS "Admins can update any comment" ON public.comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.comments;
DROP POLICY IF EXISTS "Admins can delete any comment" ON public.comments;

CREATE POLICY "Admins can view all comments" ON public.comments
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = (select auth.uid())
        AND r.name IN ('admin', 'manager')
    )
);

CREATE POLICY "Authenticated users can create comments" ON public.comments
FOR INSERT WITH CHECK (
    (select auth.uid()) = user_id
    AND (select auth.role()) = 'authenticated'
    AND status = 'active'
);

CREATE POLICY "Users can update their own comments" ON public.comments
FOR UPDATE
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Admins can update any comment" ON public.comments
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = (select auth.uid())
        AND r.name IN ('admin', 'manager')
    )
);

CREATE POLICY "Users can delete their own comments" ON public.comments
FOR DELETE USING ((select auth.uid()) = user_id);

CREATE POLICY "Admins can delete any comment" ON public.comments
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = (select auth.uid())
        AND r.name IN ('admin', 'manager')
    )
);

-- ==========================================
-- COMMENT_RATE_LIMITS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Users can view their own rate limits" ON public.comment_rate_limits;

CREATE POLICY "Users can view their own rate limits" ON public.comment_rate_limits
FOR SELECT USING (user_id = (select auth.uid()));

-- ==========================================
-- COMMENT_FLAGS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Users can view their own flags" ON public.comment_flags;
DROP POLICY IF EXISTS "Admins can view all flags" ON public.comment_flags;
DROP POLICY IF EXISTS "Authenticated users can create flags" ON public.comment_flags;
DROP POLICY IF EXISTS "Users can delete their own flags" ON public.comment_flags;

CREATE POLICY "Users can view their own flags" ON public.comment_flags
FOR SELECT USING (flagged_by = (select auth.uid()));

CREATE POLICY "Admins can view all flags" ON public.comment_flags
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = (select auth.uid())
        AND r.name IN ('admin', 'manager')
    )
);

CREATE POLICY "Authenticated users can create flags" ON public.comment_flags
FOR INSERT WITH CHECK ((select auth.uid()) = flagged_by);

CREATE POLICY "Users can delete their own flags" ON public.comment_flags
FOR DELETE USING (flagged_by = (select auth.uid()));

-- ==========================================
-- ADDRESSES TABLE
-- ==========================================
DROP POLICY IF EXISTS "Users can view own addresses" ON public.addresses;
DROP POLICY IF EXISTS "Users can create own addresses" ON public.addresses;
DROP POLICY IF EXISTS "Users can insert own addresses" ON public.addresses;
DROP POLICY IF EXISTS "Users can update own addresses" ON public.addresses;
DROP POLICY IF EXISTS "Users can delete own addresses" ON public.addresses;
DROP POLICY IF EXISTS "Admins can view all addresses" ON public.addresses;

CREATE POLICY "Users can view own addresses" ON public.addresses
FOR SELECT USING (user_id = (select auth.uid()));

CREATE POLICY "Users can create own addresses" ON public.addresses
FOR INSERT WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own addresses" ON public.addresses
FOR UPDATE USING (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own addresses" ON public.addresses
FOR DELETE USING (user_id = (select auth.uid()));

CREATE POLICY "Admins can view all addresses" ON public.addresses
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = (select auth.uid())
        AND r.name IN ('admin', 'manager')
    )
);

-- ==========================================
-- PAYMENTS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can view all payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can update payments" ON public.payments;
DROP POLICY IF EXISTS "Enable read for own payments" ON public.payments;
DROP POLICY IF EXISTS "Enable update for own payments" ON public.payments;

CREATE POLICY "Users can view own payments" ON public.payments
FOR SELECT USING (user_id = (select auth.uid()));

CREATE POLICY "Admins can view all payments" ON public.payments
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = (select auth.uid())
        AND r.name IN ('admin', 'manager')
    )
);

CREATE POLICY "Admins can update payments" ON public.payments
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = (select auth.uid())
        AND r.name IN ('admin', 'manager')
    )
);

CREATE POLICY "Enable read for own payments" ON public.payments
FOR SELECT USING (user_id = (select auth.uid()));

CREATE POLICY "Enable update for own payments" ON public.payments
FOR UPDATE USING (user_id = (select auth.uid()));

-- ==========================================
-- ORDER_NOTIFICATIONS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Admins can view notifications" ON public.order_notifications;
DROP POLICY IF EXISTS "Admins can update notifications" ON public.order_notifications;

CREATE POLICY "Admins can view notifications" ON public.order_notifications
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = (select auth.uid())
        AND r.name IN ('admin', 'manager')
    )
);

CREATE POLICY "Admins can update notifications" ON public.order_notifications
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = (select auth.uid())
        AND r.name IN ('admin', 'manager')
    )
);

-- ==========================================
-- ORDERS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;

CREATE POLICY "Users can view own orders" ON public.orders
FOR SELECT USING (user_id = (select auth.uid()));

-- ==========================================
-- PHONE_NUMBERS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Users can view own phone numbers" ON public.phone_numbers;
DROP POLICY IF EXISTS "Users can create own phone numbers" ON public.phone_numbers;
DROP POLICY IF EXISTS "Users can update own phone numbers" ON public.phone_numbers;
DROP POLICY IF EXISTS "Users can delete own phone numbers" ON public.phone_numbers;

CREATE POLICY "Users can view own phone numbers" ON public.phone_numbers
FOR SELECT USING (user_id = (select auth.uid()));

CREATE POLICY "Users can create own phone numbers" ON public.phone_numbers
FOR INSERT WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own phone numbers" ON public.phone_numbers
FOR UPDATE USING (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own phone numbers" ON public.phone_numbers
FOR DELETE USING (user_id = (select auth.uid()));

-- ==========================================
-- DONATIONS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Users can view own donations" ON public.donations;
DROP POLICY IF EXISTS "Users can insert own donations" ON public.donations;

CREATE POLICY "Users can view own donations" ON public.donations
FOR SELECT USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own donations" ON public.donations
FOR INSERT WITH CHECK (user_id = (select auth.uid()) OR user_id IS NULL);

-- ==========================================
-- DONATION_SUBSCRIPTIONS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.donation_subscriptions;

CREATE POLICY "Users can view own subscriptions" ON public.donation_subscriptions
FOR SELECT USING (user_id = (select auth.uid()));

-- ==========================================
-- ORDER_ITEMS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;

CREATE POLICY "Users can view own order items" ON public.order_items
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM orders
        WHERE orders.id = order_items.order_id
        AND orders.user_id = (select auth.uid())
    )
);

-- ==========================================
-- RETURNS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Users can create return requests" ON public.returns;
DROP POLICY IF EXISTS "Users can view own returns" ON public.returns;

CREATE POLICY "Users can create return requests" ON public.returns
FOR INSERT WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can view own returns" ON public.returns
FOR SELECT USING (user_id = (select auth.uid()));

-- ==========================================
-- RETURN_ITEMS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Users can view own return items" ON public.return_items;
DROP POLICY IF EXISTS "Users can insert own return items" ON public.return_items;

CREATE POLICY "Users can view own return items" ON public.return_items
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM returns
        WHERE returns.id = return_items.return_id
        AND returns.user_id = (select auth.uid())
    )
);

CREATE POLICY "Users can insert own return items" ON public.return_items
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM returns
        WHERE returns.id = return_id
        AND returns.user_id = (select auth.uid())
    )
);

-- ==========================================
-- EMAIL_LOGS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Admin and manager can read email logs" ON public.email_logs;

CREATE POLICY "Admin and manager can read email logs" ON public.email_logs
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = (select auth.uid())
        AND r.name IN ('admin', 'manager')
    )
);

-- ==========================================
-- ORDER_STATUS_HISTORY TABLE
-- ==========================================
DROP POLICY IF EXISTS "Users can view their own order status history" ON public.order_status_history;
DROP POLICY IF EXISTS "Admins can view all order status history" ON public.order_status_history;

CREATE POLICY "Users can view their own order status history" ON public.order_status_history
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM orders
        WHERE orders.id = order_status_history.order_id
        AND orders.user_id = (select auth.uid())
    )
);

CREATE POLICY "Admins can view all order status history" ON public.order_status_history
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = (select auth.uid())
        AND r.name IN ('admin', 'manager')
    )
);

-- ==========================================
-- EMAIL_NOTIFICATIONS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Users can view their own email notifications" ON public.email_notifications;
DROP POLICY IF EXISTS "Admins can view all email notifications" ON public.email_notifications;

CREATE POLICY "Users can view their own email notifications" ON public.email_notifications
FOR SELECT USING (user_id = (select auth.uid()));

CREATE POLICY "Admins can view all email notifications" ON public.email_notifications
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = (select auth.uid())
        AND r.name IN ('admin', 'manager')
    )
);

-- ==========================================
-- CONTACT_MESSAGES TABLE
-- ==========================================
DROP POLICY IF EXISTS "Admins can view contact messages" ON public.contact_messages;

CREATE POLICY "Admins can view contact messages" ON public.contact_messages
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = (select auth.uid())
        AND r.name IN ('admin', 'manager')
    )
);

-- ==========================================
-- POLICY_PAGES TABLE
-- ==========================================
DROP POLICY IF EXISTS "Admin can manage policies" ON public.policy_pages;

CREATE POLICY "Admin can manage policies" ON public.policy_pages
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = (select auth.uid())
        AND r.name IN ('admin', 'manager')
    )
);

-- ==========================================
-- EVENT_REFUNDS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Users can view own refunds" ON public.event_refunds;
DROP POLICY IF EXISTS "Users can view their own refunds" ON public.event_refunds;
DROP POLICY IF EXISTS "Admins can manage all refunds" ON public.event_refunds;
DROP POLICY IF EXISTS "Users view own" ON public.event_refunds;

CREATE POLICY "Users can view own refunds" ON public.event_refunds
FOR SELECT USING (user_id = (select auth.uid()));

CREATE POLICY "Admins can manage all refunds" ON public.event_refunds
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = (select auth.uid())
        AND r.name IN ('admin', 'manager')
    )
);

-- ==========================================
-- EVENT_CANCELLATION_JOBS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Admins can see cancellation jobs" ON public.event_cancellation_jobs;
DROP POLICY IF EXISTS "Admins can manage cancellation jobs" ON public.event_cancellation_jobs;

CREATE POLICY "Admins can see cancellation jobs" ON public.event_cancellation_jobs
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = (select auth.uid())
        AND r.name IN ('admin', 'manager')
    )
);

CREATE POLICY "Admins can manage cancellation jobs" ON public.event_cancellation_jobs
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = (select auth.uid())
        AND r.name IN ('admin', 'manager')
    )
);

-- ==========================================
-- EVENT_REGISTRATIONS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Admins can manage all registrations" ON public.event_registrations;
DROP POLICY IF EXISTS "Users select own" ON public.event_registrations;
DROP POLICY IF EXISTS "Users insert own" ON public.event_registrations;
DROP POLICY IF EXISTS "Users update own" ON public.event_registrations;

CREATE POLICY "Admins can manage all registrations" ON public.event_registrations
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = (select auth.uid())
        AND r.name IN ('admin', 'manager')
    )
);

CREATE POLICY "Users select own" ON public.event_registrations
FOR SELECT USING (user_id = (select auth.uid()));

CREATE POLICY "Users insert own" ON public.event_registrations
FOR INSERT WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users update own" ON public.event_registrations
FOR UPDATE USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

-- ==========================================
-- ACCOUNT_DELETION_JOBS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Admins can view deletion jobs" ON public.account_deletion_jobs;

CREATE POLICY "Admins can view deletion jobs" ON public.account_deletion_jobs
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = (select auth.uid())
        AND r.name IN ('admin', 'manager')
    )
);

-- ==========================================
-- ACCOUNT_DELETION_AUDIT TABLE
-- ==========================================
DROP POLICY IF EXISTS "Admins can view audit" ON public.account_deletion_audit;

CREATE POLICY "Admins can view audit" ON public.account_deletion_audit
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = (select auth.uid())
        AND r.name IN ('admin', 'manager')
    )
);

-- ==========================================
-- DELETION_AUTHORIZATION_TOKENS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Users can view own tokens" ON public.deletion_authorization_tokens;

CREATE POLICY "Users can view own tokens" ON public.deletion_authorization_tokens
FOR SELECT USING (user_id = (select auth.uid()));

COMMIT;
