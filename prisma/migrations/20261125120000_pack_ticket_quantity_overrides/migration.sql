-- Append-only audit evidence for per-pack ticket quantity changes.
-- The expected quantity is a server-side snapshot of the owning Game.ticketsPerPack
-- at the time of the edit; no caller-supplied expected value is stored.
CREATE TABLE "pack_ticket_quantity_overrides" (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  pack_id TEXT NOT NULL,
  serial_number TEXT NOT NULL,
  pack_number TEXT,
  game_name TEXT NOT NULL,
  game_number TEXT NOT NULL,
  expected_ticket_quantity INTEGER NOT NULL CHECK (expected_ticket_quantity > 0),
  recorded_ticket_quantity INTEGER NOT NULL CHECK (recorded_ticket_quantity > 0),
  reason TEXT NOT NULL CHECK (length(btrim(reason)) > 0),
  status TEXT NOT NULL DEFAULT 'RECORDED' CHECK (status = 'RECORDED'),
  actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (expected_ticket_quantity <> recorded_ticket_quantity)
);

CREATE INDEX "pack_ticket_quantity_overrides_store_created_idx"
  ON "pack_ticket_quantity_overrides" (store_id, created_at DESC);
CREATE INDEX "pack_ticket_quantity_overrides_pack_created_idx"
  ON "pack_ticket_quantity_overrides" (pack_id, created_at DESC);

-- Preserve this relation as an append-only audit log at the database boundary.
CREATE FUNCTION prevent_pack_ticket_quantity_override_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'pack ticket quantity override audit records are immutable';
END;
$$;
CREATE TRIGGER pack_ticket_quantity_overrides_immutable
  BEFORE UPDATE OR DELETE ON "pack_ticket_quantity_overrides"
  FOR EACH ROW EXECUTE FUNCTION prevent_pack_ticket_quantity_override_mutation();

-- Guard ownership and the catalog snapshot at insertion as well as in the API.
CREATE FUNCTION validate_pack_ticket_quantity_override_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  pack_store_id TEXT;
  game_store_id TEXT;
  actor_store_id TEXT;
  catalog_quantity INTEGER;
  pack_quantity INTEGER;
BEGIN
  SELECT p."storeId", p."ticketQuantity", g."storeId", g."ticketsPerPack"
    INTO pack_store_id, pack_quantity, game_store_id, catalog_quantity
    FROM packs p
    JOIN games g ON g.id = p."gameId"
   WHERE p.id = NEW.pack_id;
  SELECT u."storeId" INTO actor_store_id FROM users u WHERE u.id = NEW.actor_user_id;
  IF pack_store_id IS DISTINCT FROM NEW.store_id
     OR game_store_id IS DISTINCT FROM NEW.store_id
     OR actor_store_id IS DISTINCT FROM NEW.store_id THEN
    RAISE EXCEPTION 'pack ticket quantity override ownership mismatch';
  END IF;
  IF catalog_quantity IS DISTINCT FROM NEW.expected_ticket_quantity
     OR pack_quantity IS DISTINCT FROM NEW.recorded_ticket_quantity THEN
    RAISE EXCEPTION 'pack ticket quantity override snapshot mismatch';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER pack_ticket_quantity_overrides_validate_insert
  BEFORE INSERT ON "pack_ticket_quantity_overrides"
  FOR EACH ROW EXECUTE FUNCTION validate_pack_ticket_quantity_override_insert();
