-- ============================================================================
-- AuraPost AI - Unified Product Normalization PostgreSQL Schema Specification
-- Target: Standardizes raw scraped catalog variations under a strict unified format
-- ============================================================================

-- Create a schema dedicated to data ingestion to isolate raw inputs from system cores
CREATE SCHEMA IF NOT EXISTS ingestion;

-- Create domains/types to constrain ingest states
CREATE TYPE ingestion_state AS ENUM ('initialized', 'fetching', 'downloading_media', 'normalizing', 'completed', 'failed');

-- ----------------------------------------------------------------------------
-- 1. RAW INGESTION DUMP TABLE
-- ----------------------------------------------------------------------------
-- Captures raw metadata as structured JSON directly from our fetchers
CREATE TABLE IF NOT EXISTS ingestion.raw_imports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL,
    project_id UUID NOT NULL,
    source_platform VARCHAR(50) NOT NULL, -- 'shopify', 'amazon', 'aliexpress', 'alibaba', 'woocommerce'
    source_url TEXT NOT NULL,
    status ingestion_state DEFAULT 'initialized' NOT NULL,
    
    -- raw json document payload from scraper workers
    raw_payload JSONB DEFAULT '{}'::jsonb NOT NULL,
    
    attempts_count INTEGER DEFAULT 0 NOT NULL,
    last_error_log TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ----------------------------------------------------------------------------
-- 2. INTEGRITY CHECKS (JSON SCHEMA VALIDATION)
-- ----------------------------------------------------------------------------
-- Standard constraints placed inside products to validate nested variant JSON payloads

CREATE TABLE IF NOT EXISTS normalized_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL,
    project_id UUID NOT NULL,
    
    -- Base catalog characteristics
    title VARCHAR(255) NOT NULL,
    handle VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    compare_at_price NUMERIC(12, 2) CHECK (compare_at_price >= price),
    currency VARCHAR(4) DEFAULT 'USD' NOT NULL,
    
    -- Categorization parameters
    category VARCHAR(255),
    tags VARCHAR(100)[] DEFAULT '{}'::VARCHAR(100)[],
    brand VARCHAR(120),
    vendor VARCHAR(255),
    
    -- Processing links
    source_platform VARCHAR(50) NOT NULL,
    source_url TEXT NOT NULL UNIQUE,
    raw_import_id UUID REFERENCES ingestion.raw_imports(id) ON DELETE SET NULL,
    
    -- Multi-images list
    images TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    
    -- Dynamic specifications map (Flexible key-values e.g. weight, material, power)
    specifications JSONB DEFAULT '{}'::jsonb NOT NULL,
    
    -- High integrity variants schema mapping [JSONB array conforming to validation targets]
    variants JSONB DEFAULT '[]'::jsonb NOT NULL,
    
    created_by_user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Guard rails to assert variants is formatted as a valid list
    CONSTRAINT valid_variants_json DEFAULT (jsonb_typeof(variants) = 'array')
);

-- ----------------------------------------------------------------------------
-- 3. ENHANCED NORMALIZATION HELPER FUNCTIONS
-- ----------------------------------------------------------------------------
-- Safely extract prices out of mismatched numeric characters ($49.99, £49.99, etc.)
CREATE OR REPLACE FUNCTION ingestion.extract_numeric_price(price_str TEXT)
RETURNS NUMERIC AS $$
DECLARE
    cleaned_price TEXT;
BEGIN
    IF price_str IS NULL THEN
        RETURN 0.00;
    END IF;
    
    -- Strip non-numeric and non-decimal characters, keeping numbers and standard decimal points
    cleaned_price := regexp_replace(price_str, '[^\d\.]', '', 'g');
    
    -- If string is empty, output zero decimal
    IF cleaned_price = '' THEN
        RETURN 0.00;
    END IF;
    
    RETURN cleaned_price::NUMERIC(12, 2);
EXCEPTION WHEN OTHERS THEN
    RETURN 0.00;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ----------------------------------------------------------------------------
-- 4. TRIGGER SYSTEM TO AUTO-CALCULATE HANDLES
-- ----------------------------------------------------------------------------
-- Standardizes handle names (slugs) before writing records down
CREATE OR REPLACE FUNCTION unique_product_slug()
RETURNS TRIGGER AS $$
DECLARE
    slug_val TEXT;
    loop_count INTEGER := 0;
    matched_id UUID;
BEGIN
    -- Strip accents, special characters, replace spaces with hyphens, lowercase
    slug_val := lower(regexp_replace(NEW.title, '[^a-zA-Z0-9\s]', '', 'g'));
    slug_val := regexp_replace(slug_val, '\s+', '-', 'g');
    
    -- Handle boundaries where name results in whitespace characters
    IF slug_val = '' OR slug_val IS NULL THEN
        slug_val := 'product-' || floor(random()*(9999-1000)+1000);
    END IF;
    
    -- Check for conflicts in handles matching work scopes
    LOOP
        SELECT id INTO matched_id FROM normalized_products 
        WHERE handle = slug_val AND project_id = NEW.project_id AND id != NEW.id;
        
        IF matched_id IS NULL THEN
            NEW.handle := slug_val;
            RETURN NEW;
        END IF;
        
        loop_count := loop_count + 1;
        slug_val := regexp_replace(slug_val, '-[0-9]+$', '') || '-' || loop_count;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_normalized_products_slug
    BEFORE INSERT OR UPDATE ON normalized_products
    FOR EACH ROW
    EXECUTE FUNCTION unique_product_slug();

-- ----------------------------------------------------------------------------
-- 5. TUNING INDEXES FOR NORMALIZED DATA
-- ----------------------------------------------------------------------------
-- High performant query mapping tools
CREATE INDEX IF NOT EXISTS idx_normalized_products_project ON normalized_products (project_id);
CREATE INDEX IF NOT EXISTS idx_normalized_products_platform ON normalized_products (source_platform);

-- GIN Index on nested JSONB variables for rich attribute search e.g. colors, material
CREATE INDEX IF NOT EXISTS idx_normalized_products_variants_gin ON normalized_products USING gin (variants);
CREATE INDEX IF NOT EXISTS idx_normalized_products_specs_gin ON normalized_products USING gin (specifications);
