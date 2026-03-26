ALTER TABLE contact_info
ADD COLUMN IF NOT EXISTS map_latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS map_longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS google_place_id TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'contact_info_map_latitude_range'
    ) THEN
        ALTER TABLE contact_info
        ADD CONSTRAINT contact_info_map_latitude_range
        CHECK (map_latitude IS NULL OR (map_latitude >= -90 AND map_latitude <= 90));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'contact_info_map_longitude_range'
    ) THEN
        ALTER TABLE contact_info
        ADD CONSTRAINT contact_info_map_longitude_range
        CHECK (map_longitude IS NULL OR (map_longitude >= -180 AND map_longitude <= 180));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'contact_info_map_coordinates_pair'
    ) THEN
        ALTER TABLE contact_info
        ADD CONSTRAINT contact_info_map_coordinates_pair
        CHECK (
            (map_latitude IS NULL AND map_longitude IS NULL)
            OR (map_latitude IS NOT NULL AND map_longitude IS NOT NULL)
        );
    END IF;
END $$;
