-- ============================================================================
-- AuraPost AI - Product Intelligence & Ledger Schema Specification
-- Target: Version-controlled product analyses, billing balances & credit tracking
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS intelligence;

-- Create domains/types to isolate transaction classes
CREATE TYPE credit_transaction_type AS ENUM ('subscription_allocation', 'bonus_credit', 'ingest_consume', 'analysis_consume', 'copy_consume', 'refund');
CREATE TYPE subscription_tier_type AS ENUM ('free', 'starter', 'pro', 'enterprise');

-- ----------------------------------------------------------------------------
-- 1. WORKSPACE BILLING AND BALANCES
-- ----------------------------------------------------------------------------
-- Standardizes workspace tier properties, subscription renewals, and active credits
CREATE TABLE IF NOT EXISTS intelligence.workspace_billing (
    workspace_id UUID PRIMARY KEY,
    tier subscription_tier_type DEFAULT 'free'::subscription_tier_type NOT NULL,
    credits_balance INTEGER DEFAULT 100 NOT NULL,
    max_credits_limit INTEGER DEFAULT 100 NOT NULL,
    subscription_period_end TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Ensure balances can never drop below zero to prevent balance bypass exploits
    CONSTRAINT positive_balance CHECK (credits_balance >= 0)
);

-- ----------------------------------------------------------------------------
-- 2. CREDIT TRANSACTION LEDGER
-- ----------------------------------------------------------------------------
-- A strict APPEND-ONLY double-entry ledger tracing credit allocations and consumptions
CREATE TABLE IF NOT EXISTS intelligence.credit_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES intelligence.workspace_billing(workspace_id) ON DELETE CASCADE,
    transaction_type credit_transaction_type NOT NULL,
    amount INTEGER NOT NULL, -- Negative for consumes, positive for allocations/refunds
    running_balance INTEGER NOT NULL, -- Balance remaining after transaction complete
    
    -- Audit details mapping down to the originating event
    reference_id UUID, -- References raw_imports, product_analyses, or subscription checkout sessions
    user_id UUID, -- Originating user who performed the operation
    description TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ----------------------------------------------------------------------------
-- 3. PRODUCT ANALYSES HISTORY TABLE (VERSION CONTROLLER)
-- ----------------------------------------------------------------------------
-- Holds normalized analysis iterations. Rows are IMMUTABLE - updates insert a new version.
CREATE TABLE IF NOT EXISTS intelligence.product_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL, -- REFERENCES product catalog table
    workspace_id UUID NOT NULL REFERENCES intelligence.workspace_billing(workspace_id) ON DELETE CASCADE,
    
    -- Revision attributes
    version INTEGER DEFAULT 1 NOT NULL,
    is_latest BOOLEAN DEFAULT true NOT NULL,
    language_code VARCHAR(10) DEFAULT 'en' NOT NULL, -- 'en', 'es', 'fr', 'de' etc.
    
    -- Statistical Reliability rating
    confidence_score NUMERIC(4, 3) DEFAULT 1.000 NOT NULL CHECK (confidence_score >= 0.000 AND confidence_score <= 1.000),
    
    -- LLM Provider Performance Audits
    ai_provider VARCHAR(50) NOT NULL, -- 'gemini', 'openai'
    ai_model VARCHAR(100) NOT NULL, -- 'gemini-3.5-flash', 'gpt-4o-mini'
    prompt_tokens_count INTEGER NOT NULL,
    completion_tokens_count INTEGER NOT NULL,
    latency_milliseconds INTEGER NOT NULL,
    
    -- JSON Data Payloads structured by specific analytical branches
    opportunity_scores JSONB DEFAULT '{}'::jsonb NOT NULL,
    market_intelligence JSONB DEFAULT '{}'::jsonb NOT NULL,
    marketing_intelligence JSONB DEFAULT '{}'::jsonb NOT NULL,
    creative_intelligence JSONB DEFAULT '{}'::jsonb NOT NULL,
    
    -- Database timestamp mapping
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ----------------------------------------------------------------------------
-- 4. VIEWS FOR REPORT SUMMARIES
-- ----------------------------------------------------------------------------
-- Simplifies query generation on products by always pulling the latest parsed report context
CREATE OR REPLACE VIEW intelligence.vw_latest_product_analyses AS
SELECT DISTINCT ON (product_id, language_code) 
    id,
    product_id,
    workspace_id,
    version,
    language_code,
    confidence_score,
    ai_provider,
    ai_model,
    opportunity_scores,
    market_intelligence,
    marketing_intelligence,
    creative_intelligence,
    created_at
FROM intelligence.product_analyses
ORDER BY product_id, language_code, version DESC;

-- ----------------------------------------------------------------------------
-- 5. AUTOMATED DB TRIGGERS & PROCEDURES
-- ----------------------------------------------------------------------------

-- Procedure to safely trigger a re-analysis. Updates history, increments version pointers and isolates active flags.
CREATE OR REPLACE FUNCTION intelligence.fn_prepare_new_analysis_version()
RETURNS TRIGGER AS $$
DECLARE
    next_version INTEGER := 1;
BEGIN
    -- Detect existing analysis versions for this product and language
    SELECT COALESCE(MAX(version), 0) + 1 INTO next_version 
    FROM intelligence.product_analyses
    WHERE product_id = NEW.product_id AND language_code = NEW.language_code;
    
    -- Set NEW record attributes
    NEW.version := next_version;
    NEW.is_latest := true;
    
    -- Deactivate older latest trackers for this specific product/language set
    UPDATE intelligence.product_analyses
    SET is_latest = false
    WHERE product_id = NEW.product_id AND language_code = NEW.language_code AND is_latest = true;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prepare_new_analysis_version
    BEFORE INSERT ON intelligence.product_analyses
    FOR EACH ROW
    EXECUTE FUNCTION intelligence.fn_prepare_new_analysis_version();

-- Trigger to automate atomic credit balance reductions upon committing ledger events
CREATE OR REPLACE FUNCTION intelligence.fn_sync_workspace_credit_balances()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE intelligence.workspace_billing
    SET credits_balance = credits_balance + NEW.amount,
        updated_at = timezone('utc'::text, now())
    WHERE workspace_id = NEW.workspace_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_workspace_credit_balances
    AFTER INSERT ON intelligence.credit_ledger
    FOR EACH ROW
    EXECUTE FUNCTION intelligence.fn_sync_workspace_credit_balances();

-- ----------------------------------------------------------------------------
-- 6. INDEX OPTIMIZATIONS
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_prod_analyses_product_lang ON intelligence.product_analyses (product_id, language_code);
CREATE INDEX IF NOT EXISTS idx_prod_analyses_is_latest ON intelligence.product_analyses (product_id) WHERE is_latest = true;

-- GIN indexes for sub-nested property lookups e.g., finding products which perform best on instagram
CREATE INDEX IF NOT EXISTS idx_prod_analyses_opportunity_scores ON intelligence.product_analyses USING gin (opportunity_scores);
CREATE INDEX IF NOT EXISTS idx_prod_analyses_market_intel ON intelligence.product_analyses USING gin (market_intelligence);
CREATE INDEX IF NOT EXISTS idx_prod_analyses_marketing_intel ON intelligence.product_analyses USING gin (marketing_intelligence);
CREATE INDEX IF NOT EXISTS idx_prod_analyses_creative_intel ON intelligence.product_analyses USING gin (creative_intelligence);
