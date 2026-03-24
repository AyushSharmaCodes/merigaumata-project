INSERT INTO store_settings (key, value, description)
VALUES (
    'delivery_gst_mode',
    '"inclusive"',
    'How delivery GST should be applied: inclusive or exclusive'
)
ON CONFLICT (key) DO NOTHING;
