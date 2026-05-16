CREATE TABLE records (
  name TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  district TEXT NOT NULL,
  status TEXT NOT NULL
);

-- INSERT INTO records (name, role, district, status) VALUES
--   ('Sarah Chen', 'Nurse', 'Sector 4', 'Verified'),
--   ('Marcus Hale', 'Engineer', 'Sector 5', 'Missing'),
--   ('Lina Torres', 'Security', '???', 'Corrupted'),
--   ('Daniel Okafor', 'Doctor', 'Sector 4', 'Missing'),
--   ('Priya Anand', 'Courier', '???', 'Corrupted'),
--   ('Victor Reyes', 'Clerk', '???', 'Missing'),
--   ('Helena Voss', 'Administrator', 'Sector 1', 'Verified');

INSERT INFO records (first_name, last_name, age) VALUES
  ('Sarah', 'Chen', '50')
