CREATE TABLE records (
  name TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  district TEXT NOT NULL,
  status TEXT NOT NULL
);

INSERT INTO records (name, role, district, status) VALUES
  ('Sarah Chen', 'Nurse', 'Sector 4', 'Verified'),
  ('Marcus Hale', 'Engineer', 'Sector 2', 'Missing'),
  ('Lina Torres', 'Security', '???', 'Corrupted');
