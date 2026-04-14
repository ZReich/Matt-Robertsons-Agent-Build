-- =============================================================================
-- POST-MIGRATION: Postgres-specific features Prisma can't express natively
-- Run this AFTER `prisma migrate dev` completes.
-- =============================================================================

-- =============================================================================
-- FULL-TEXT SEARCH INDEXES (GIN on tsvector)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_communications_fts
  ON communications
  USING GIN (to_tsvector('english', coalesce(subject, '') || ' ' || coalesce(body, '')));

CREATE INDEX IF NOT EXISTS idx_contacts_fts
  ON contacts
  USING GIN (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(company, '') || ' ' || coalesce(notes, '')));

CREATE INDEX IF NOT EXISTS idx_deals_fts
  ON deals
  USING GIN (to_tsvector('english', coalesce(property_address, '') || ' ' || coalesce(notes, '')));

CREATE INDEX IF NOT EXISTS idx_todos_fts
  ON todos
  USING GIN (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, '')));

CREATE INDEX IF NOT EXISTS idx_meetings_fts
  ON meetings
  USING GIN (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(location, '') || ' ' || coalesce(notes, '')));

CREATE INDEX IF NOT EXISTS idx_agent_memory_fts
  ON agent_memory
  USING GIN (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, '')));

CREATE INDEX IF NOT EXISTS idx_templates_fts
  ON templates
  USING GIN (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(subject, '') || ' ' || coalesce(body, '')));

-- =============================================================================
-- JSONB GIN INDEXES (for tag filtering and metadata queries)
-- e.g., WHERE tags @> '["follow-up"]'
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_contacts_tags ON contacts USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_deals_tags ON deals USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_communications_tags ON communications USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_communications_metadata ON communications USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_meetings_tags ON meetings USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_todos_tags ON todos USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_templates_tags ON templates USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_agent_memory_tags ON agent_memory USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_deals_key_contacts ON deals USING GIN (key_contacts);

-- =============================================================================
-- COMPOSITE INDEXES (for the most common query patterns)
-- =============================================================================

-- "Show all communications for this contact, newest first"
CREATE INDEX IF NOT EXISTS idx_communications_contact_date
  ON communications (contact_id, date DESC);

-- "Show all communications for this deal, newest first"
CREATE INDEX IF NOT EXISTS idx_communications_deal_date
  ON communications (deal_id, date DESC);

-- "Show deals at this stage, ordered by listing date"
CREATE INDEX IF NOT EXISTS idx_deals_stage_listed
  ON deals (stage, listed_date DESC);

-- "Show open todos by priority and due date"
CREATE INDEX IF NOT EXISTS idx_todos_status_priority_due
  ON todos (status, priority, due_date);

-- "Show upcoming meetings"
CREATE INDEX IF NOT EXISTS idx_meetings_date_deal
  ON meetings (date, deal_id);

-- =============================================================================
-- PARTIAL INDEXES (for soft-delete / active records)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_contacts_active
  ON contacts (name) WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_deals_active
  ON deals (stage) WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_communications_active
  ON communications (date DESC) WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_todos_active
  ON todos (status, due_date) WHERE archived_at IS NULL;

-- =============================================================================
-- HELPER: Full-text search across communications
-- Usage: SELECT * FROM search_communications('john smith inspection');
-- =============================================================================
CREATE OR REPLACE FUNCTION search_communications(search_query text)
RETURNS SETOF communications AS $$
  SELECT *
  FROM communications
  WHERE archived_at IS NULL
    AND to_tsvector('english', coalesce(subject, '') || ' ' || coalesce(body, ''))
        @@ plainto_tsquery('english', search_query)
  ORDER BY ts_rank(
    to_tsvector('english', coalesce(subject, '') || ' ' || coalesce(body, '')),
    plainto_tsquery('english', search_query)
  ) DESC, date DESC;
$$ LANGUAGE sql STABLE;

-- =============================================================================
-- HELPER: Global search across all business entities
-- Usage: SELECT * FROM global_search('west end plaza');
-- =============================================================================
CREATE OR REPLACE FUNCTION global_search(search_query text)
RETURNS TABLE(entity_type text, entity_id uuid, title text, rank real) AS $$
  -- Search contacts
  SELECT 'contact'::text, id::uuid, name, ts_rank(
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(company, '') || ' ' || coalesce(notes, '')),
    plainto_tsquery('english', search_query)
  ) as rank
  FROM contacts
  WHERE archived_at IS NULL
    AND to_tsvector('english', coalesce(name, '') || ' ' || coalesce(company, '') || ' ' || coalesce(notes, ''))
        @@ plainto_tsquery('english', search_query)

  UNION ALL

  -- Search deals
  SELECT 'deal'::text, id::uuid, property_address, ts_rank(
    to_tsvector('english', coalesce(property_address, '') || ' ' || coalesce(notes, '')),
    plainto_tsquery('english', search_query)
  )
  FROM deals
  WHERE archived_at IS NULL
    AND to_tsvector('english', coalesce(property_address, '') || ' ' || coalesce(notes, ''))
        @@ plainto_tsquery('english', search_query)

  UNION ALL

  -- Search communications
  SELECT 'communication'::text, id::uuid, coalesce(subject, channel::text), ts_rank(
    to_tsvector('english', coalesce(subject, '') || ' ' || coalesce(body, '')),
    plainto_tsquery('english', search_query)
  )
  FROM communications
  WHERE archived_at IS NULL
    AND to_tsvector('english', coalesce(subject, '') || ' ' || coalesce(body, ''))
        @@ plainto_tsquery('english', search_query)

  UNION ALL

  -- Search todos
  SELECT 'todo'::text, id::uuid, title, ts_rank(
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, '')),
    plainto_tsquery('english', search_query)
  )
  FROM todos
  WHERE archived_at IS NULL
    AND to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))
        @@ plainto_tsquery('english', search_query)

  UNION ALL

  -- Search meetings
  SELECT 'meeting'::text, id::uuid, title, ts_rank(
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(location, '') || ' ' || coalesce(notes, '')),
    plainto_tsquery('english', search_query)
  )
  FROM meetings
  WHERE archived_at IS NULL
    AND to_tsvector('english', coalesce(title, '') || ' ' || coalesce(location, '') || ' ' || coalesce(notes, ''))
        @@ plainto_tsquery('english', search_query)

  UNION ALL

  -- Search templates
  SELECT 'template'::text, id::uuid, name, ts_rank(
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(subject, '') || ' ' || coalesce(body, '')),
    plainto_tsquery('english', search_query)
  )
  FROM templates
  WHERE to_tsvector('english', coalesce(name, '') || ' ' || coalesce(subject, '') || ' ' || coalesce(body, ''))
        @@ plainto_tsquery('english', search_query)

  ORDER BY rank DESC
  LIMIT 50;
$$ LANGUAGE sql STABLE;
