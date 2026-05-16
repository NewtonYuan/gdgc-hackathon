DO $$
BEGIN
  CREATE TYPE connection_status AS ENUM (
    'auto_linked',
    'suggested',
    'confirmed',
    'dismissed',
    'disputed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_a uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  profile_b uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status connection_status NOT NULL,
  confidence integer NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  match_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_evaluated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (profile_a <> profile_b)
);

CREATE UNIQUE INDEX IF NOT EXISTS connections_unordered_pair_idx
  ON connections (LEAST(profile_a, profile_b), GREATEST(profile_a, profile_b));

CREATE INDEX IF NOT EXISTS connections_profile_a_idx ON connections(profile_a);
CREATE INDEX IF NOT EXISTS connections_profile_b_idx ON connections(profile_b);
CREATE INDEX IF NOT EXISTS connections_status_idx ON connections(status);
