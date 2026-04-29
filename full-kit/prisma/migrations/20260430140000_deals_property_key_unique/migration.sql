-- Partial unique index: prevent two ACTIVE seller_rep deals from sharing the
-- same propertyKey. Buyer-rep deals and archived deals are exempt — both can
-- legitimately share a property_key with another row.
--
-- Prisma's schema DSL can't express partial unique indexes, so this migration
-- is hand-written. A doc comment on @@index([propertyKey]) in schema.prisma
-- records the constraint for future maintainers.
CREATE UNIQUE INDEX deals_property_key_seller_rep_active_uidx
  ON deals (property_key)
  WHERE deal_type = 'seller_rep'
    AND archived_at IS NULL
    AND property_key IS NOT NULL;
