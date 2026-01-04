CREATE TABLE IF NOT EXISTS demands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  demand_no TEXT,
  demand_date DATE,
  required_date DATE,
  project TEXT,
  item TEXT,
  unit TEXT,
  demanded_qty INTEGER
);

CREATE TABLE IF NOT EXISTS supplies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  demand_id INTEGER,
  supply_date DATE,
  supplied_qty INTEGER,
  supplier TEXT
);
