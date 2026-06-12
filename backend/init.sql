CREATE TABLE IF NOT EXISTS branches (
  id SERIAL PRIMARY KEY,
  branch_name VARCHAR(100) NOT NULL,
  location VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS grounds (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  ground_name VARCHAR(100) NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 10
);

CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  customer_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  ground_id INTEGER NOT NULL REFERENCES grounds(id) ON DELETE CASCADE,
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL
);

INSERT INTO branches (branch_name, location)
SELECT 'Eagle Box Cricket - Madhapur', 'Madhapur'
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE branch_name = 'Eagle Box Cricket - Madhapur');

INSERT INTO branches (branch_name, location)
SELECT 'Eagle Box Cricket - Kukatpally', 'Kukatpally'
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE branch_name = 'Eagle Box Cricket - Kukatpally');

INSERT INTO branches (branch_name, location)
SELECT 'Eagle Box Cricket - Kompally', 'Kompally'
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE branch_name = 'Eagle Box Cricket - Kompally');

INSERT INTO grounds (branch_id, ground_name, capacity)
SELECT id, 'Ground A', 10 FROM branches WHERE branch_name = 'Eagle Box Cricket - Madhapur'
ON CONFLICT DO NOTHING;

INSERT INTO grounds (branch_id, ground_name, capacity)
SELECT id, 'Ground B', 10 FROM branches WHERE branch_name = 'Eagle Box Cricket - Madhapur'
ON CONFLICT DO NOTHING;

INSERT INTO grounds (branch_id, ground_name, capacity)
SELECT id, 'Ground A', 10 FROM branches WHERE branch_name = 'Eagle Box Cricket - Kukatpally'
ON CONFLICT DO NOTHING;

INSERT INTO grounds (branch_id, ground_name, capacity)
SELECT id, 'Ground B', 10 FROM branches WHERE branch_name = 'Eagle Box Cricket - Kukatpally'
ON CONFLICT DO NOTHING;

INSERT INTO grounds (branch_id, ground_name, capacity)
SELECT id, 'Ground A', 10 FROM branches WHERE branch_name = 'Eagle Box Cricket - Kompally'
ON CONFLICT DO NOTHING;

INSERT INTO grounds (branch_id, ground_name, capacity)
SELECT id, 'Ground B', 10 FROM branches WHERE branch_name = 'Eagle Box Cricket - Kompally'
ON CONFLICT DO NOTHING;

INSERT INTO admins (username, password)
SELECT 'admin', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM admins WHERE username = 'admin');
