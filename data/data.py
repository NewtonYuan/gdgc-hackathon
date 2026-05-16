"""
Build verify_deny.db — a pre-seeded SQLite database for the VERIFY//DENY
hackathon project. Contains a normalized schema for citizens, their
occupations, documents, and a symmetric web-of-trust connection graph.

Connections are stored once per pair with citizen_a_id < citizen_b_id,
enforced by a CHECK constraint, so symmetry is structural — no validation
needed because asymmetric rows can't physically exist.

Run this once locally to produce verify_deny.db. Open it in DB Browser
for SQLite to inspect.
"""

import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(__file__), "verify_deny.db")

# Wipe any previous build so re-runs are deterministic
if os.path.exists(DB_PATH):
    os.remove(DB_PATH)

conn = sqlite3.connect(DB_PATH)
conn.execute("PRAGMA foreign_keys = ON")
cur = conn.cursor()

# ============================================================
# SCHEMA
# ============================================================
cur.executescript("""
CREATE TABLE citizens (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age BETWEEN 5 AND 85),
  gender TEXT NOT NULL CHECK (gender IN ('male','female','nonbinary')),
  photo_url TEXT NOT NULL,
  street TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  occupation_type TEXT NOT NULL CHECK (
    occupation_type IN ('employed','student','unemployed','retired')
  ),
  verification_status TEXT NOT NULL CHECK (
    verification_status IN ('verified','unverified','pending','denied')
  ),
  trust_score INTEGER NOT NULL CHECK (trust_score BETWEEN 0 AND 100),
  created_at TEXT NOT NULL
);

CREATE TABLE employment_details (
  citizen_id TEXT PRIMARY KEY REFERENCES citizens(id) ON DELETE CASCADE,
  job_title TEXT NOT NULL,
  employer TEXT NOT NULL,
  work_address TEXT NOT NULL
);

CREATE TABLE student_details (
  citizen_id TEXT PRIMARY KEY REFERENCES citizens(id) ON DELETE CASCADE,
  institution TEXT NOT NULL,
  student_id TEXT NOT NULL,
  field_of_study TEXT NOT NULL,
  year_of_study INTEGER NOT NULL
);

CREATE TABLE retired_details (
  citizen_id TEXT PRIMARY KEY REFERENCES citizens(id) ON DELETE CASCADE,
  former_occupation TEXT
);

CREATE TABLE documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  citizen_id TEXT NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (
    type IN ('national_id','passport','student_id','birth_certificate','drivers_license')
  ),
  document_number TEXT NOT NULL,
  issued_date TEXT NOT NULL,
  expiry_date TEXT,
  issuing_authority TEXT NOT NULL
);

CREATE TABLE connections (
  citizen_a_id TEXT NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
  citizen_b_id TEXT NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL CHECK (
    relationship IN ('family','spouse','colleague','classmate',
                     'neighbor','friend','employer','employee')
  ),
  strength INTEGER NOT NULL CHECK (strength BETWEEN 1 AND 10),
  PRIMARY KEY (citizen_a_id, citizen_b_id),
  CHECK (citizen_a_id < citizen_b_id)
);

CREATE INDEX idx_documents_citizen ON documents(citizen_id);
CREATE INDEX idx_connections_a ON connections(citizen_a_id);
CREATE INDEX idx_connections_b ON connections(citizen_b_id);
""")

# ============================================================
# CITIZEN IDs — short readable handles for the seed code,
# mapped to stable UUIDs.
# ============================================================
ID = {
    # Chen family (Sector 4 — 12 Riverside Ave & 14 Riverside Ave)
    "sarah":    "a1b2c3d4-0001-4000-8000-000000000001",
    "david":    "a1b2c3d4-0002-4000-8000-000000000002",
    "emily":    "a1b2c3d4-0003-4000-8000-000000000003",
    "henry":    "a1b2c3d4-0004-4000-8000-000000000004",

    # Te Awa family (Grid Lane)
    "maia":     "b2c3d4e5-0005-4000-8000-000000000005",
    "rawiri":   "b2c3d4e5-0006-4000-8000-000000000006",
    "tane":     "b2c3d4e5-0007-4000-8000-000000000007",

    # Aurora General Hospital workmates
    "james":    "c3d4e5f6-0008-4000-8000-000000000008",
    "priya":    "c3d4e5f6-0009-4000-8000-000000000009",
    "liam":     "c3d4e5f6-0010-4000-8000-000000000010",
    "aisha":    "c3d4e5f6-0011-4000-8000-000000000011",

    # Grid Authority + Public Works (Grid Lane neighborhood)
    "marcus":   "d4e5f6a7-0012-4000-8000-000000000012",
    "sophie":   "d4e5f6a7-0013-4000-8000-000000000013",
    "kenji":    "d4e5f6a7-0014-4000-8000-000000000014",

    # University of Auckland (Old Town Rd shared housing)
    "ana":      "e5f6a7b8-0015-4000-8000-000000000015",
    "jordan":   "e5f6a7b8-0016-4000-8000-000000000016",
    "yusuf":    "e5f6a7b8-0017-4000-8000-000000000017",
    "elena":    "e5f6a7b8-0018-4000-8000-000000000018",

    # Loners / sparse bridges
    "mira":     "f6a7b8c9-0019-4000-8000-000000000019",
    "thomas":   "f6a7b8c9-0020-4000-8000-000000000020",

    # Extra citizens to round out clusters and reach >20
    "ben":      "a7b8c9d0-0021-4000-8000-000000000021",  # Chen family cousin
    "lucia":    "a7b8c9d0-0022-4000-8000-000000000022",  # Hospital nurse
    "samir":    "a7b8c9d0-0023-4000-8000-000000000023",  # University lecturer
    "freya":    "a7b8c9d0-0024-4000-8000-000000000024",  # Public Works
    "ihaka":    "a7b8c9d0-0025-4000-8000-000000000025",  # Grid Authority apprentice
}

def photo(cid):
    return f"https://i.pravatar.cc/150?u={cid}"

# ============================================================
# CITIZENS
# (id, first_name, last_name, age, gender, photo_url,
#  street, city, country, occupation_type,
#  verification_status, trust_score, created_at)
# ============================================================
citizens = [
    (ID["sarah"],  "Sarah",   "Chen",     42, "female",    photo(ID["sarah"]),  "12 Riverside Ave",  "Auckland", "New Zealand", "employed",   "verified",   88, "2031-02-10T09:00:00Z"),
    (ID["david"],  "David",   "Chen",     45, "male",      photo(ID["david"]),  "12 Riverside Ave",  "Auckland", "New Zealand", "employed",   "verified",   85, "2031-02-10T09:15:00Z"),
    (ID["emily"],  "Emily",   "Chen",     17, "female",    photo(ID["emily"]),  "12 Riverside Ave",  "Auckland", "New Zealand", "student",    "verified",   72, "2031-02-10T09:30:00Z"),
    (ID["henry"],  "Henry",   "Chen",     73, "male",      photo(ID["henry"]),  "14 Riverside Ave",  "Auckland", "New Zealand", "retired",    "verified",   90, "2031-02-11T10:00:00Z"),

    (ID["maia"],   "Maia",    "Te Awa",   38, "female",    photo(ID["maia"]),   "47 Grid Lane",      "Auckland", "New Zealand", "employed",   "verified",   82, "2031-02-12T08:00:00Z"),
    (ID["rawiri"], "Rawiri",  "Te Awa",   40, "male",      photo(ID["rawiri"]), "47 Grid Lane",      "Auckland", "New Zealand", "employed",   "verified",   80, "2031-02-12T08:15:00Z"),
    (ID["tane"],   "Tane",    "Te Awa",   12, "male",      photo(ID["tane"]),   "47 Grid Lane",      "Auckland", "New Zealand", "student",    "verified",   65, "2031-02-12T08:30:00Z"),

    (ID["james"],  "James",   "Okonkwo",  51, "male",      photo(ID["james"]),  "88 Harbor Rd",      "Auckland", "New Zealand", "employed",   "verified",   92, "2031-02-13T11:00:00Z"),
    (ID["priya"],  "Priya",   "Sharma",   34, "female",    photo(ID["priya"]),  "15 Northshore Dr",  "Auckland", "New Zealand", "employed",   "verified",   86, "2031-02-13T11:30:00Z"),
    (ID["liam"],   "Liam",    "O'Brien",  29, "male",      photo(ID["liam"]),   "22 Northshore Dr",  "Auckland", "New Zealand", "employed",   "verified",   78, "2031-02-14T09:00:00Z"),
    (ID["aisha"],  "Aisha",   "Hassan",   31, "female",    photo(ID["aisha"]),  "24 Northshore Dr",  "Auckland", "New Zealand", "employed",   "verified",   81, "2031-02-14T09:30:00Z"),

    (ID["marcus"], "Marcus",  "Hale",     46, "male",      photo(ID["marcus"]), "49 Grid Lane",      "Auckland", "New Zealand", "employed",   "verified",   84, "2031-02-15T10:00:00Z"),
    (ID["sophie"], "Sophie",  "Larsen",   39, "female",    photo(ID["sophie"]), "51 Grid Lane",      "Auckland", "New Zealand", "employed",   "verified",   79, "2031-02-15T10:30:00Z"),
    (ID["kenji"],  "Kenji",   "Nakamura", 52, "male",      photo(ID["kenji"]),  "53 Grid Lane",      "Auckland", "New Zealand", "employed",   "verified",   83, "2031-02-15T11:00:00Z"),

    (ID["ana"],    "Ana",     "Silva",    20, "female",    photo(ID["ana"]),    "5 Old Town Rd",     "Auckland", "New Zealand", "student",    "verified",   68, "2031-02-16T09:00:00Z"),
    (ID["jordan"], "Jordan",  "Mitchell", 21, "nonbinary", photo(ID["jordan"]), "7 Old Town Rd",     "Auckland", "New Zealand", "student",    "pending",    55, "2031-02-16T09:30:00Z"),
    (ID["yusuf"],  "Yusuf",   "Karimi",   23, "male",      photo(ID["yusuf"]),  "9 Old Town Rd",     "Auckland", "New Zealand", "student",    "unverified", 40, "2031-02-16T10:00:00Z"),
    (ID["elena"],  "Elena",   "Vasquez",  58, "female",    photo(ID["elena"]),  "10 Old Town Rd",    "Auckland", "New Zealand", "employed",   "verified",   89, "2031-02-16T10:30:00Z"),

    (ID["mira"],   "Mira",    "Joshi",    27, "female",    photo(ID["mira"]),   "101 Quay St",       "Auckland", "New Zealand", "unemployed", "unverified", 30, "2031-02-17T12:00:00Z"),
    (ID["thomas"], "Thomas",  "Wright",   67, "male",      photo(ID["thomas"]), "203 Pier Lane",     "Auckland", "New Zealand", "retired",    "denied",     15, "2031-02-17T12:30:00Z"),

    (ID["ben"],    "Ben",     "Chen",     35, "male",      photo(ID["ben"]),    "8 Riverside Ave",   "Auckland", "New Zealand", "employed",   "verified",   77, "2031-02-18T08:00:00Z"),
    (ID["lucia"],  "Lucia",   "Romano",   28, "female",    photo(ID["lucia"]),  "26 Northshore Dr",  "Auckland", "New Zealand", "employed",   "verified",   75, "2031-02-18T08:30:00Z"),
    (ID["samir"],  "Samir",   "Patel",    44, "male",      photo(ID["samir"]),  "17 Northshore Dr",  "Auckland", "New Zealand", "employed",   "verified",   87, "2031-02-18T09:00:00Z"),
    (ID["freya"],  "Freya",   "Andersen", 31, "female",    photo(ID["freya"]),  "55 Grid Lane",      "Auckland", "New Zealand", "employed",   "verified",   76, "2031-02-18T09:30:00Z"),
    (ID["ihaka"],  "Ihaka",   "Walker",   24, "male",      photo(ID["ihaka"]),  "57 Grid Lane",      "Auckland", "New Zealand", "employed",   "verified",   62, "2031-02-18T10:00:00Z"),
]

cur.executemany("""
  INSERT INTO citizens
    (id, first_name, last_name, age, gender, photo_url,
     street, city, country, occupation_type,
     verification_status, trust_score, created_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
""", citizens)

# ============================================================
# OCCUPATION DETAIL TABLES
# ============================================================
employment = [
    (ID["sarah"],  "Cardiac Nurse",          "Aurora General Hospital", "200 Hospital Way, Auckland"),
    (ID["david"],  "Logistics Coordinator",  "Aurora General Hospital", "200 Hospital Way, Auckland"),
    (ID["maia"],   "Trauma Surgeon",         "Aurora General Hospital", "200 Hospital Way, Auckland"),
    (ID["rawiri"], "Power Engineer",         "Grid Authority",          "50 Industrial Pkwy, Auckland"),
    (ID["james"],  "Hospital Administrator", "Aurora General Hospital", "200 Hospital Way, Auckland"),
    (ID["priya"],  "Senior Lecturer",        "University of Auckland",  "14 Symonds St, Auckland"),
    (ID["liam"],   "Grid Technician",        "Grid Authority",          "50 Industrial Pkwy, Auckland"),
    (ID["aisha"],  "Pharmacist",             "Aurora General Hospital", "200 Hospital Way, Auckland"),
    (ID["marcus"], "Senior Power Engineer",  "Grid Authority",          "50 Industrial Pkwy, Auckland"),
    (ID["sophie"], "Civil Engineer",         "Auckland Public Works",   "88 Civic Sq, Auckland"),
    (ID["kenji"],  "Architect",              "Auckland Public Works",   "88 Civic Sq, Auckland"),
    (ID["elena"],  "Bookshop Owner",         "Vasquez Books",           "12 Old Town Rd, Auckland"),
    (ID["ben"],    "Paramedic",              "Aurora General Hospital", "200 Hospital Way, Auckland"),
    (ID["lucia"],  "Nurse Practitioner",     "Aurora General Hospital", "200 Hospital Way, Auckland"),
    (ID["samir"],  "Associate Professor",    "University of Auckland",  "14 Symonds St, Auckland"),
    (ID["freya"],  "Structural Engineer",    "Auckland Public Works",   "88 Civic Sq, Auckland"),
    (ID["ihaka"],  "Grid Apprentice",        "Grid Authority",          "50 Industrial Pkwy, Auckland"),
]
cur.executemany(
    "INSERT INTO employment_details VALUES (?,?,?,?)", employment
)

students = [
    (ID["emily"],  "Auckland Grammar",       "AGS-2031-0414",  "General",            12),
    (ID["tane"],   "Sector 2 Middle School", "S2M-2031-0188",  "General",             7),
    (ID["ana"],    "University of Auckland", "UOA-2030-15829", "Computer Science",    2),
    (ID["jordan"], "University of Auckland", "UOA-2030-16104", "Civil Engineering",   3),
    (ID["yusuf"],  "University of Auckland", "UOA-2029-14012", "Medicine",            4),
]
cur.executemany(
    "INSERT INTO student_details VALUES (?,?,?,?,?)", students
)

retired = [
    (ID["henry"],  "High School Principal"),
    (ID["thomas"], "Fisherman"),
]
cur.executemany(
    "INSERT INTO retired_details VALUES (?,?)", retired
)

# ============================================================
# DOCUMENTS — plausible per age and role
# (citizen_id, type, document_number, issued_date, expiry_date, issuing_authority)
# ============================================================
documents = [
    # Sarah Chen, 42
    (ID["sarah"], "national_id",       "NZ-ID-1989-447821", "2025-05-12", "2035-05-12", "NZ-GOV"),
    (ID["sarah"], "passport",          "NZ-P-7783-2241",    "2027-08-03", "2037-08-03", "NZ-GOV"),
    (ID["sarah"], "drivers_license",   "NZ-DL-22-099812",   "2022-01-20", "2032-01-20", "NZ Transport Agency"),
    (ID["sarah"], "birth_certificate", "NZ-BC-1989-441",    "1989-03-15", None,         "NZ-GOV"),

    # David Chen, 45
    (ID["david"], "national_id",       "NZ-ID-1986-330217", "2024-11-04", "2034-11-04", "NZ-GOV"),
    (ID["david"], "passport",          "NZ-P-6612-1009",    "2026-02-18", "2036-02-18", "NZ-GOV"),
    (ID["david"], "drivers_license",   "NZ-DL-21-117422",   "2021-06-15", "2031-06-15", "NZ Transport Agency"),

    # Emily Chen, 17
    (ID["emily"], "student_id",        "AGS-2031-0414",     "2031-01-28", None,         "Auckland Grammar"),
    (ID["emily"], "birth_certificate", "NZ-BC-2014-9912",   "2014-07-22", None,         "NZ-GOV"),

    # Henry Chen, 73
    (ID["henry"], "national_id",       "NZ-ID-1958-114002", "2020-09-11", "2030-09-11", "NZ-GOV"),
    (ID["henry"], "passport",          "NZ-P-4421-7780",    "2023-12-01", "2033-12-01", "NZ-GOV"),

    # Maia Te Awa, 38
    (ID["maia"], "national_id",       "NZ-ID-1993-552003", "2026-04-20", "2036-04-20", "NZ-GOV"),
    (ID["maia"], "passport",          "NZ-P-8801-3344",    "2028-06-12", "2038-06-12", "NZ-GOV"),
    (ID["maia"], "drivers_license",   "NZ-DL-24-201144",   "2024-03-22", "2034-03-22", "NZ Transport Agency"),

    # Rawiri Te Awa, 40
    (ID["rawiri"], "national_id",     "NZ-ID-1991-441098", "2025-07-08", "2035-07-08", "NZ-GOV"),
    (ID["rawiri"], "drivers_license", "NZ-DL-20-090117",   "2020-11-30", "2030-11-30", "NZ Transport Agency"),

    # Tane Te Awa, 12
    (ID["tane"], "student_id",        "S2M-2031-0188",     "2031-01-28", None,         "Sector 2 Middle School"),
    (ID["tane"], "birth_certificate", "NZ-BC-2019-3344",   "2019-04-18", None,         "NZ-GOV"),

    # James Okonkwo, 51
    (ID["james"], "national_id",       "NZ-ID-1980-220471", "2023-01-12", "2033-01-12", "NZ-GOV"),
    (ID["james"], "passport",          "NZ-P-5512-8881",    "2025-04-05", "2035-04-05", "NZ-GOV"),
    (ID["james"], "drivers_license",   "NZ-DL-19-088190",   "2019-08-09", "2029-08-09", "NZ Transport Agency"),

    # Priya Sharma, 34
    (ID["priya"], "national_id", "NZ-ID-1997-771044", "2027-02-28", "2037-02-28", "NZ-GOV"),
    (ID["priya"], "passport",    "NZ-P-9921-4400",    "2029-09-14", "2039-09-14", "NZ-GOV"),

    # Liam O'Brien, 29
    (ID["liam"], "national_id",     "NZ-ID-2002-885109", "2029-06-17", "2039-06-17", "NZ-GOV"),
    (ID["liam"], "drivers_license", "NZ-DL-26-414009",   "2026-11-02", "2036-11-02", "NZ Transport Agency"),

    # Aisha Hassan, 31
    (ID["aisha"], "national_id", "NZ-ID-2000-993122", "2028-05-04", "2038-05-04", "NZ-GOV"),
    (ID["aisha"], "passport",    "NZ-P-1102-7755",    "2030-01-20", "2040-01-20", "NZ-GOV"),

    # Marcus Hale, 46
    (ID["marcus"], "national_id",     "NZ-ID-1985-119388", "2024-08-29", "2034-08-29", "NZ-GOV"),
    (ID["marcus"], "passport",        "NZ-P-7700-2231",    "2026-10-11", "2036-10-11", "NZ-GOV"),
    (ID["marcus"], "drivers_license", "NZ-DL-18-007713",   "2018-03-04", "2028-03-04", "NZ Transport Agency"),

    # Sophie Larsen, 39
    (ID["sophie"], "national_id", "NZ-ID-1992-664420", "2025-12-19", "2035-12-19", "NZ-GOV"),
    (ID["sophie"], "passport",    "NZ-P-8843-9912",    "2027-07-22", "2037-07-22", "NZ-GOV"),

    # Kenji Nakamura, 52
    (ID["kenji"], "national_id",     "NZ-ID-1979-220117", "2022-10-02", "2032-10-02", "NZ-GOV"),
    (ID["kenji"], "passport",        "NZ-P-4421-0099",    "2024-05-30", "2034-05-30", "NZ-GOV"),
    (ID["kenji"], "drivers_license", "NZ-DL-17-301155",   "2017-01-15", "2027-01-15", "NZ Transport Agency"),

    # Ana Silva, 20
    (ID["ana"], "national_id",       "NZ-ID-2011-447001", "2029-02-15", "2039-02-15", "NZ-GOV"),
    (ID["ana"], "student_id",        "UOA-2030-15829",    "2030-02-22", None,         "University of Auckland"),
    (ID["ana"], "birth_certificate", "NZ-BC-2011-7766",   "2011-09-09", None,         "NZ-GOV"),

    # Jordan Mitchell, 21
    (ID["jordan"], "national_id", "NZ-ID-2010-339118", "2028-11-11", "2038-11-11", "NZ-GOV"),
    (ID["jordan"], "student_id",  "UOA-2030-16104",    "2030-02-22", None,         "University of Auckland"),

    # Yusuf Karimi, 23
    (ID["yusuf"], "national_id", "NZ-ID-2008-220993", "2027-04-08", "2037-04-08", "NZ-GOV"),
    (ID["yusuf"], "student_id",  "UOA-2029-14012",    "2029-02-19", None,         "University of Auckland"),
    (ID["yusuf"], "passport",    "NZ-P-2230-1145",    "2028-12-04", "2038-12-04", "NZ-GOV"),

    # Elena Vasquez, 58
    (ID["elena"], "national_id",     "NZ-ID-1973-118077", "2021-03-30", "2031-03-30", "NZ-GOV"),
    (ID["elena"], "passport",        "NZ-P-3320-8841",    "2023-08-15", "2033-08-15", "NZ-GOV"),
    (ID["elena"], "drivers_license", "NZ-DL-15-991022",   "2015-06-01", "2025-06-01", "NZ Transport Agency"),

    # Mira Joshi, 27 — sparse documentation, hence unverified
    (ID["mira"], "national_id", "NZ-ID-2004-770221", "2030-07-19", "2040-07-19", "NZ-GOV"),

    # Thomas Wright, 67 — denied
    (ID["thomas"], "national_id",       "NZ-ID-1964-002288", "2019-11-08", "2029-11-08", "NZ-GOV"),
    (ID["thomas"], "birth_certificate", "NZ-BC-1964-117",    "1964-02-29", None,         "NZ-GOV"),

    # Ben Chen, 35
    (ID["ben"], "national_id",     "NZ-ID-1996-118445", "2026-09-22", "2036-09-22", "NZ-GOV"),
    (ID["ben"], "passport",        "NZ-P-7012-3340",    "2028-04-07", "2038-04-07", "NZ-GOV"),
    (ID["ben"], "drivers_license", "NZ-DL-23-220117",   "2023-02-14", "2033-02-14", "NZ Transport Agency"),

    # Lucia Romano, 28
    (ID["lucia"], "national_id", "NZ-ID-2003-665209", "2028-08-08", "2038-08-08", "NZ-GOV"),
    (ID["lucia"], "passport",    "NZ-P-6630-1199",    "2029-11-30", "2039-11-30", "NZ-GOV"),

    # Samir Patel, 44
    (ID["samir"], "national_id",     "NZ-ID-1987-330229", "2024-02-11", "2034-02-11", "NZ-GOV"),
    (ID["samir"], "passport",        "NZ-P-5501-9920",    "2026-06-29", "2036-06-29", "NZ-GOV"),
    (ID["samir"], "drivers_license", "NZ-DL-19-119033",   "2019-04-21", "2029-04-21", "NZ Transport Agency"),

    # Freya Andersen, 31
    (ID["freya"], "national_id",     "NZ-ID-2000-117822", "2028-03-15", "2038-03-15", "NZ-GOV"),
    (ID["freya"], "drivers_license", "NZ-DL-22-330118",   "2022-08-19", "2032-08-19", "NZ Transport Agency"),

    # Ihaka Walker, 24
    (ID["ihaka"], "national_id",     "NZ-ID-2007-441229", "2030-05-04", "2040-05-04", "NZ-GOV"),
    (ID["ihaka"], "drivers_license", "NZ-DL-25-119887",   "2025-12-01", "2035-12-01", "NZ Transport Agency"),
]
cur.executemany("""
  INSERT INTO documents (citizen_id, type, document_number, issued_date, expiry_date, issuing_authority)
  VALUES (?,?,?,?,?,?)
""", documents)

# ============================================================
# CONNECTIONS — store once per pair (a < b enforced by CHECK).
# A helper sorts the two IDs so we don't have to think about ordering.
# ============================================================
def edge(a, b, rel, strength):
    if a == b:
        raise ValueError(f"Self-loop: {a}")
    lo, hi = (a, b) if a < b else (b, a)
    return (lo, hi, rel, strength)

raw_edges = [
    # Chen family
    edge(ID["sarah"],  ID["david"],  "spouse",   10),
    edge(ID["sarah"],  ID["emily"],  "family",    9),
    edge(ID["sarah"],  ID["henry"],  "family",    7),
    edge(ID["david"],  ID["emily"],  "family",    9),
    edge(ID["david"],  ID["henry"],  "family",    8),
    edge(ID["emily"],  ID["henry"],  "family",    6),
    edge(ID["sarah"],  ID["ben"],    "family",    7),
    edge(ID["david"],  ID["ben"],    "family",    7),
    edge(ID["ben"],    ID["henry"],  "family",    6),

    # Te Awa family
    edge(ID["maia"],   ID["rawiri"], "spouse",   10),
    edge(ID["maia"],   ID["tane"],   "family",    9),
    edge(ID["rawiri"], ID["tane"],   "family",    9),

    # Aurora General Hospital colleagues
    edge(ID["sarah"],  ID["maia"],   "colleague", 8),
    edge(ID["sarah"],  ID["james"],  "employee",  5),
    edge(ID["sarah"],  ID["aisha"],  "colleague", 7),
    edge(ID["sarah"],  ID["lucia"],  "colleague", 7),
    edge(ID["sarah"],  ID["ben"],    "colleague", 6),
    edge(ID["david"],  ID["maia"],   "colleague", 6),
    edge(ID["david"],  ID["james"],  "employee",  5),
    edge(ID["david"],  ID["aisha"],  "colleague", 4),
    edge(ID["maia"],   ID["james"],  "employee",  6),
    edge(ID["maia"],   ID["aisha"],  "colleague", 7),
    edge(ID["maia"],   ID["lucia"],  "colleague", 8),
    edge(ID["maia"],   ID["ben"],    "colleague", 6),
    edge(ID["james"],  ID["aisha"],  "employer",  5),
    edge(ID["james"],  ID["lucia"],  "employer",  5),
    edge(ID["james"],  ID["ben"],    "employer",  5),
    edge(ID["aisha"],  ID["lucia"],  "colleague", 6),
    edge(ID["lucia"],  ID["ben"],    "colleague", 6),

    # Grid Authority colleagues
    edge(ID["rawiri"], ID["liam"],   "colleague", 6),
    edge(ID["rawiri"], ID["marcus"], "colleague", 8),
    edge(ID["rawiri"], ID["ihaka"],  "colleague", 5),
    edge(ID["liam"],   ID["marcus"], "employee",  7),
    edge(ID["liam"],   ID["ihaka"],  "colleague", 6),
    edge(ID["marcus"], ID["ihaka"],  "employer",  5),

    # Auckland Public Works colleagues
    edge(ID["sophie"], ID["kenji"],  "colleague", 8),
    edge(ID["sophie"], ID["freya"],  "colleague", 7),
    edge(ID["kenji"],  ID["freya"],  "colleague", 7),

    # University of Auckland — students + lecturers
    edge(ID["ana"],    ID["jordan"], "classmate", 6),
    edge(ID["ana"],    ID["yusuf"],  "classmate", 4),
    edge(ID["jordan"], ID["yusuf"],  "classmate", 5),
    edge(ID["priya"],  ID["ana"],    "employer",  5),
    edge(ID["priya"],  ID["jordan"], "employer",  4),
    edge(ID["priya"],  ID["samir"],  "colleague", 7),
    edge(ID["samir"],  ID["yusuf"],  "employer",  6),
    edge(ID["samir"],  ID["ana"],    "employer",  4),

    # Northshore Dr neighbors
    edge(ID["priya"],  ID["liam"],   "neighbor",  4),
    edge(ID["priya"],  ID["aisha"],  "neighbor",  5),
    edge(ID["priya"],  ID["samir"],  "neighbor",  6),
    edge(ID["priya"],  ID["lucia"],  "neighbor",  5),
    edge(ID["liam"],   ID["aisha"],  "neighbor",  5),
    edge(ID["liam"],   ID["samir"],  "neighbor",  4),
    edge(ID["aisha"],  ID["lucia"],  "neighbor",  5),
    edge(ID["samir"],  ID["lucia"],  "neighbor",  4),

    # Grid Lane neighbors
    edge(ID["maia"],   ID["marcus"], "neighbor",  6),
    edge(ID["rawiri"], ID["marcus"], "neighbor",  7),
    edge(ID["marcus"], ID["sophie"], "neighbor",  5),
    edge(ID["sophie"], ID["kenji"],  "neighbor",  6),
    edge(ID["kenji"],  ID["freya"],  "neighbor",  5),
    edge(ID["freya"],  ID["ihaka"],  "neighbor",  4),

    # Old Town Rd neighbors
    edge(ID["ana"],    ID["elena"],  "neighbor",  5),
    edge(ID["jordan"], ID["elena"],  "neighbor",  4),
    edge(ID["yusuf"],  ID["elena"],  "neighbor",  6),
    edge(ID["ana"],    ID["jordan"], "neighbor",  6),
    edge(ID["jordan"], ID["yusuf"],  "neighbor",  5),

    # Riverside Ave neighbors (Chen family + Henry)
    edge(ID["sarah"],  ID["henry"],  "neighbor",  5),
    edge(ID["david"],  ID["henry"],  "neighbor",  5),

    # Friend bridges between clusters
    edge(ID["sarah"],  ID["sophie"], "friend",    5),
    edge(ID["priya"],  ID["elena"],  "friend",    6),
    edge(ID["kenji"],  ID["samir"],  "friend",    5),

    # Mira and Thomas are loners — no edges
]

# Deduplicate before insert: edge() may emit the same pair more than once
# if seed includes both a "colleague" and a "neighbor" relationship between
# two people. Keep the strongest single relationship per pair.
best_per_pair = {}
for a, b, rel, strength in raw_edges:
    key = (a, b)
    prev = best_per_pair.get(key)
    if prev is None or strength > prev[3]:
        best_per_pair[key] = (a, b, rel, strength)

cur.executemany(
    "INSERT INTO connections VALUES (?,?,?,?)",
    list(best_per_pair.values()),
)

conn.commit()

# ============================================================
# POST-BUILD SANITY CHECKS
# ============================================================
print("=" * 60)
print("verify_deny.db — build summary")
print("=" * 60)

def count(sql):
    return cur.execute(sql).fetchone()[0]

print(f"Citizens:             {count('SELECT COUNT(*) FROM citizens')}")
print(f"Employment records:   {count('SELECT COUNT(*) FROM employment_details')}")
print(f"Student records:      {count('SELECT COUNT(*) FROM student_details')}")
print(f"Retired records:      {count('SELECT COUNT(*) FROM retired_details')}")
print(f"Documents:            {count('SELECT COUNT(*) FROM documents')}")
print(f"Connections (edges):  {count('SELECT COUNT(*) FROM connections')}")
print()

# Verify the structural symmetry invariant
asymmetric = count("SELECT COUNT(*) FROM connections WHERE citizen_a_id >= citizen_b_id")
assert asymmetric == 0, f"FAIL: {asymmetric} rows violate a<b ordering"
print(f"Symmetry check:       PASS (all {count('SELECT COUNT(*) FROM connections')} edges stored with a<b)")

# Verification status distribution
print()
print("Verification status distribution:")
for status, n in cur.execute(
    "SELECT verification_status, COUNT(*) FROM citizens GROUP BY verification_status"
).fetchall():
    print(f"  {status:12s} {n}")

# Most-connected citizens (graph degree)
print()
print("Most-connected citizens (by degree):")
top = cur.execute("""
  WITH degrees AS (
    SELECT citizen_a_id AS id FROM connections
    UNION ALL
    SELECT citizen_b_id FROM connections
  )
  SELECT c.first_name || ' ' || c.last_name AS name, COUNT(d.id) AS degree
  FROM citizens c
  LEFT JOIN degrees d ON d.id = c.id
  GROUP BY c.id
  ORDER BY degree DESC, name
  LIMIT 5
""").fetchall()
for name, degree in top:
    print(f"  {name:24s} {degree} connections")

# Distinct employers and institutions
print()
employers = [r[0] for r in cur.execute(
    "SELECT DISTINCT employer FROM employment_details ORDER BY employer"
).fetchall()]
print(f"Employers ({len(employers)}):")
for e in employers:
    print(f"  - {e}")

institutions = [r[0] for r in cur.execute(
    "SELECT DISTINCT institution FROM student_details ORDER BY institution"
).fetchall()]
print(f"\nInstitutions ({len(institutions)}):")
for i in institutions:
    print(f"  - {i}")

conn.close()
print()
print(f"Database written to {DB_PATH}")