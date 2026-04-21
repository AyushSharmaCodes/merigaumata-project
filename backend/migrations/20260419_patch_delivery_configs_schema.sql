-- ============================================================
-- Migration: Patch delivery_configs table to support rich variant
--            and product-level delivery configuration rules.
-- Created: 2026-04-19
-- Context: The baseline table only had legacy columns (charge,
--          gst_rate, region). The application code expects
--          calculation_type, base_delivery_charge, gst_percentage,
--          is_taxable, max_items_per_package, unit_weight, and
--          delivery_refund_policy. This patch adds those columns
--          and migrates any existing legacy data.
-- ============================================================

-- 1. Add missing operational columns (idempotent DO blocks)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'delivery_configs'
        AND column_name = 'calculation_type') THEN
        ALTER TABLE public.delivery_configs
            ADD COLUMN calculation_type TEXT NOT NULL DEFAULT 'FLAT_PER_ORDER'
                CHECK (calculation_type IN ('FLAT_PER_ORDER','PER_ITEM','PER_PACKAGE','WEIGHT_BASED'));
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'delivery_configs'
        AND column_name = 'base_delivery_charge') THEN
        ALTER TABLE public.delivery_configs
            ADD COLUMN base_delivery_charge NUMERIC(10,2) NOT NULL DEFAULT 0
                CHECK (base_delivery_charge >= 0);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'delivery_configs'
        AND column_name = 'max_items_per_package') THEN
        ALTER TABLE public.delivery_configs
            ADD COLUMN max_items_per_package INTEGER DEFAULT 3
                CHECK (max_items_per_package >= 1);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'delivery_configs'
        AND column_name = 'unit_weight') THEN
        ALTER TABLE public.delivery_configs
            ADD COLUMN unit_weight NUMERIC(10,3) DEFAULT NULL;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'delivery_configs'
        AND column_name = 'gst_percentage') THEN
        ALTER TABLE public.delivery_configs
            ADD COLUMN gst_percentage NUMERIC(5,2) NOT NULL DEFAULT 18
                CHECK (gst_percentage >= 0 AND gst_percentage <= 100);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'delivery_configs'
        AND column_name = 'is_taxable') THEN
        ALTER TABLE public.delivery_configs
            ADD COLUMN is_taxable BOOLEAN NOT NULL DEFAULT true;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'delivery_configs'
        AND column_name = 'delivery_refund_policy') THEN
        ALTER TABLE public.delivery_configs
            ADD COLUMN delivery_refund_policy TEXT NOT NULL DEFAULT 'NON_REFUNDABLE'
                CHECK (delivery_refund_policy IN ('REFUNDABLE','NON_REFUNDABLE'));
    END IF;
END $$;

-- 2. Migrate legacy data: copy `charge` → `base_delivery_charge`,
--    `gst_rate` → `gst_percentage` for any existing rows.
UPDATE public.delivery_configs
SET
    base_delivery_charge = COALESCE(charge, 0),
    gst_percentage       = COALESCE(gst_rate, 18)
WHERE base_delivery_charge = 0 AND (charge IS NOT NULL OR gst_rate IS NOT NULL);

-- 3. Add unique indexes (only one config per product / per variant).
--    Using CREATE UNIQUE INDEX IF NOT EXISTS (requires PG 9.5+).
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'delivery_configs'
        AND indexname = 'idx_delivery_configs_product_unique'
    ) THEN
        CREATE UNIQUE INDEX idx_delivery_configs_product_unique
            ON public.delivery_configs (product_id)
            WHERE scope = 'PRODUCT' AND product_id IS NOT NULL;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'delivery_configs'
        AND indexname = 'idx_delivery_configs_variant_unique'
    ) THEN
        CREATE UNIQUE INDEX idx_delivery_configs_variant_unique
            ON public.delivery_configs (variant_id)
            WHERE scope = 'VARIANT' AND variant_id IS NOT NULL;
    END IF;
END $$;

-- 4. Scope constraint: ensure a PRODUCT row has product_id and no
--    variant_id and vice-versa. Add only if it doesn't exist.
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public' AND table_name = 'delivery_configs'
        AND constraint_name = 'chk_delivery_configs_scope'
    ) THEN
        ALTER TABLE public.delivery_configs
            ADD CONSTRAINT chk_delivery_configs_scope CHECK (
                (scope = 'PRODUCT' AND product_id IS NOT NULL AND variant_id IS NULL) OR
                (scope = 'VARIANT' AND variant_id IS NOT NULL AND product_id IS NULL)
            );
    END IF;
END $$;

-- 5. Force PostgREST to reload its schema cache so the new columns
--    are immediately available via the REST API.
NOTIFY pgrst, 'reload schema';
