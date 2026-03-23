-- Add return_request column to orders table to store partial return details

ALTER TABLE orders ADD COLUMN IF NOT EXISTS "return_request" JSONB;

COMMENT ON COLUMN orders.return_request IS 'Stores details of return request including items and reason';
