-- Database Optimization Migration
-- Created: 2026-01-25
-- Description: Adds indexes to improve dashboard stats calculation and order list performance.

-- 1. Index for Order Status and Trends
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);

-- 2. Index for Revenue Analysis (Donations)
CREATE INDEX IF NOT EXISTS idx_donations_payment_status_created_at ON public.donations(payment_status, created_at DESC);

-- 3. Index for Customer counts (Profiles)
CREATE INDEX IF NOT EXISTS idx_profiles_role_id ON public.profiles(role_id);

-- 4. Index for Events trends
CREATE INDEX IF NOT EXISTS idx_events_start_end_date ON public.events(start_date, end_date);

-- 5. Index for Order Items (often joined)
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
