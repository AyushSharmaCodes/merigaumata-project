-- Cleanup Migration: Remove NODE_ENV and EMAIL_PROVIDER from system_switches
-- These variables are now managed strictly via .env files for better predictability and startup stability.

DELETE FROM system_switches 
WHERE key IN ('NODE_ENV', 'EMAIL_PROVIDER');
