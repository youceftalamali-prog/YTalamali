-- ============================================================================
-- AuraPost AI - Production-Grade PostgreSQL Database Schema
-- Database: Supabase PostgreSQL (Standard Multi-Tenant SaaS Architecture)
-- Targets: Multi-tenancy, Row-Level Security (RLS), ACID Compliance, Scalability
-- ============================================================================

-- Enable modern extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Trigram indices for fast fuzzy product text searches

-- ----------------------------------------------------------------------------
-- 1. ENUMS & DOMAINS
-- ----------------------------------------------------------------------------
CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'enterprise');
CREATE TYPE subscription_status AS ENUM ('active', 'trialing', 'past_due', 'canceled', 'unpaid');
CREATE TYPE posting_platform AS ENUM ('facebook', 'instagram', 'tiktok', 'pinterest', 'linkedin', 'youtube');
CREATE TYPE posting_status AS ENUM ('draft', 'scheduled', 'publishing', 'published', 'failed');
CREATE TYPE ledger_transaction_type AS ENUM ('allocation', 'bonus', 'generation_copy', 'generation_creative', 'analysis_run', 'import_pull', 'refund');
CREATE TYPE audit_severity AS ENUM ('info', 'warning', 'critical', 'security_breach');

-- ----------------------------------------------------------------------------
-- 2. CORE USERS & WORKSPACES
-- ----------------------------------------------------------------------------
-- Standard SaaS Workspace model separating resources logically
CREATE TABLE NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    stripe_customer_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Users (Linked directly with Supabase auth.users or native custom JWT handlers)
CREATE TABLE NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'member' NOT NULL, -- e.g., 'owner', 'admin', 'member'
    active_workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Workspace Membership (Many-to-Many association)
CREATE TABLE NOT EXISTS workspace_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (workspace_id, user_id)
);

-- ----------------------------------------------------------------------------
-- 3. BILLING, PLANS & DEDUCTIONS (CREDIT SYSTEM)
-- ----------------------------------------------------------------------------
-- Active subscription tracking
CREATE TABLE NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
    stripe_subscription_id VARCHAR(255) UNIQUE,
    tier subscription_tier DEFAULT 'free' NOT NULL,
    status subscription_status NOT NULL,
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Credit balance registry per workspace
CREATE TABLE NOT EXISTS workspace_credits (
    workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
    credit_balance INTEGER NOT NULL DEFAULT 50 CHECK (credit_balance >= 0),
    allocated_credits INTEGER NOT NULL DEFAULT 50, -- Base tier replenishment value
    bonus_credits INTEGER NOT NULL DEFAULT 0,       -- One-off purchases
    last_replenished_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Immutable Credit Ledger (Double-Entry auditability)
CREATE TABLE NOT EXISTS credit_ledger (
    id BIGSERIAL PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL, -- Negative for spend, positive for credits earned/allocated
    transaction_type ledger_transaction_type NOT NULL,
    description TEXT,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Client invoicing snapshots
CREATE TABLE NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    stripe_invoice_id VARCHAR(255) UNIQUE,
    amount_paid NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD' NOT NULL,
    status VARCHAR(50) NOT NULL,
    invoice_pdf_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- ----------------------------------------------------------------------------
-- 4. PROJECTS & CAMPAIGN SPACES
-- ----------------------------------------------------------------------------
CREATE TABLE NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    archived BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ----------------------------------------------------------------------------
-- 5. PRODUCT IMPORT & INGESTION
-- ----------------------------------------------------------------------------
CREATE TABLE NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(12, 2) NOT NULL,
    compare_at_price NUMERIC(12, 2),
    currency VARCHAR(10) DEFAULT 'USD' NOT NULL,
    category VARCHAR(255),
    tags VARCHAR(100)[],
    brand VARCHAR(100),
    vendor VARCHAR(255),
    source_platform VARCHAR(50) NOT NULL, -- 'shopify', 'amazon', 'aliexpress', 'alibaba', 'woocommerce', 'manual'
    source_url TEXT NOT NULL,
    images TEXT[] NOT NULL DEFAULT '{}',
    variants JSONB DEFAULT '[]'::jsonb, -- Store size, colors options
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Log trace for Shopify/Amazon pulls
CREATE TABLE NOT EXISTS product_imports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    source_platform VARCHAR(50) NOT NULL,
    source_url TEXT NOT NULL,
    raw_payload JSONB DEFAULT '{}'::jsonb NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'success', 'failed'
    error_log TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ----------------------------------------------------------------------------
-- 6. PRODUCT INTELLIGENCE ENGINE (ANALYSIS SCHEMA)
-- ----------------------------------------------------------------------------
CREATE TABLE NOT EXISTS product_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE UNIQUE,
    
    -- Opportunity Core Matrix
    opportunity_overall_score INTEGER NOT NULL CHECK (opportunity_overall_score BETWEEN 0 AND 100),
    demand_score INTEGER NOT NULL,
    competition_score INTEGER NOT NULL,
    trend_score INTEGER NOT NULL,
    profitability_score INTEGER NOT NULL,
    reasoning TEXT NOT NULL,
    
    -- Market Intelligence Payload
    target_countries VARCHAR(100)[] NOT NULL,
    target_audiences TEXT[] NOT NULL,
    recommended_advertising_channels VARCHAR(100)[] NOT NULL,
    pricing_strategy TEXT NOT NULL,
    market_size_potential VARCHAR(100) NOT NULL,
    
    -- Marketing Intelligence Payload
    unique_selling_points TEXT[] NOT NULL,
    product_benefits TEXT[] NOT NULL,
    common_objections JSONB NOT NULL, -- Map { objection: response }
    emotional_triggers TEXT[] NOT NULL,
    customer_pain_points TEXT[] NOT NULL,
    
    -- Creative Intelligence Payload
    tiktok_hooks TEXT[] NOT NULL,
    marketing_angles TEXT[] NOT NULL,
    ad_concepts TEXT[] NOT NULL,
    ugc_concepts TEXT[] NOT NULL,
    
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ----------------------------------------------------------------------------
-- 7. GENERATED MARKETING CONTENT ASSETS & SCRIPTS
-- ----------------------------------------------------------------------------
CREATE TABLE NOT EXISTS campaign_copies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    objective_type VARCHAR(100) NOT NULL, -- 'hooks', 'ad_captions', 'blog', 'email', 'landing'
    tone VARCHAR(100) NOT NULL,           -- 'persuasive', 'witty', 'bold', 'professional'
    language VARCHAR(50) NOT NULL,         -- 'English', 'Spanish', 'French', 'Arabic'
    title VARCHAR(255) NOT NULL,
    items TEXT[] NOT NULL DEFAULT '{}',
    formatted_html TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ----------------------------------------------------------------------------
-- 8. PUBLISHING & SOCIAL INTEGRATIONS
-- ----------------------------------------------------------------------------
-- OAuth tokens are encrypted using pg_sodium or Vault setups
CREATE TABLE NOT EXISTS social_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    platform posting_platform NOT NULL,
    platform_user_id VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    encrypted_access_token BYTEA NOT NULL,
    encrypted_refresh_token BYTEA,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (workspace_id, platform, platform_user_id)
);

-- Scheduled & Dispatched post rows
CREATE TABLE NOT EXISTS social_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    social_account_id UUID REFERENCES social_accounts(id) ON DELETE SET NULL,
    platform posting_platform NOT NULL,
    caption TEXT NOT NULL,
    media_url TEXT[],
    status posting_status DEFAULT 'draft' NOT NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    external_post_id VARCHAR(255), -- ID returned by Facebook Graph, TikTok API, etc.
    failure_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ----------------------------------------------------------------------------
-- 9. AUDIT LOGS & PLATFORM INTEGRITY
-- ----------------------------------------------------------------------------
CREATE TABLE NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,          -- e.g., 'auth.login', 'credits.deduct', 'campaign.publish'
    severity audit_severity DEFAULT 'info' NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,    -- Captures specific parameter logs safely
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ----------------------------------------------------------------------------
-- 10. ENTERPRISE QUERY PERFORMANCE INDEXES
-- ----------------------------------------------------------------------------
-- Workspace mapping optimizations
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_lookup ON workspace_members (user_id);
CREATE INDEX IF NOT EXISTS idx_projects_workspace_lookup ON projects (workspace_id) WHERE archived = false;
CREATE INDEX IF NOT EXISTS idx_products_project_lookup ON products (project_id);

-- Publishing Queue optimization indices (CRITICAL for high-tempo Cron Tasks)
CREATE INDEX IF NOT EXISTS idx_social_posts_queue ON social_posts (status, scheduled_at) 
  WHERE status IN ('scheduled', 'publishing');

-- Audit Log index
CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_filter ON audit_logs (workspace_id, created_at DESC);

-- Fuzzy search index on Product Inventory names using Trigrams (high performance)
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- 11. ROW-LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
-- Enable RLS across tenant-scoped tables
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_copies ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 11.1 Workspaces RLS
-- A user can query a workspace if they are registered as a member inside that workspace
CREATE POLICY select_own_workspaces ON workspaces
    FOR SELECT TO authenticated
    USING (id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

-- 11.2 Projects RLS
-- Safe workspace-level boundaries for multiple projects
CREATE POLICY project_workspace_isolation ON projects
    FOR ALL TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ))
    WITH CHECK (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

-- 11.3 Products RLS
CREATE POLICY product_workspace_isolation ON products
    FOR ALL TO authenticated
    USING (project_id IN (
        SELECT id FROM projects WHERE workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    ))
    WITH CHECK (project_id IN (
        SELECT id FROM projects WHERE workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    ));

-- 11.4 Credit Ledger Read policy
-- Users can only see audit records within their active workspace membership context
CREATE POLICY ledger_workspace_isolation ON credit_ledger
    FOR SELECT TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

-- 11.5 Social Posts Operations
-- Full schedule management limits keyed inside active projects
CREATE POLICY social_posts_project_level ON social_posts
    FOR ALL TO authenticated
    USING (project_id IN (
        SELECT id FROM projects WHERE workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    ))
    WITH CHECK (project_id IN (
        SELECT id FROM projects WHERE workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    ));
