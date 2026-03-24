INSERT INTO store_settings (key, value, description)
VALUES ('base_currency', '"INR"', 'Default display currency for the storefront')
ON CONFLICT (key) DO NOTHING;
