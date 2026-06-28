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

payment_status VARCHAR(20) NOT NULL DEFAULT 'paid',

payment_method VARCHAR(30) NOT NULL DEFAULT 'Cash',

amount DECIMAL(10,2) NOT NULL DEFAULT 800,

payment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

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

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'customer',
    created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_slot_lookup
  ON bookings(branch_id, booking_date, ground_id, start_time, end_time, status);

CREATE TABLE IF NOT EXISTS cancellation_requests (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_pending_cancellation_per_booking
  ON cancellation_requests(booking_id)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_one_per_booking
  ON feedback(booking_id);

CREATE TABLE IF NOT EXISTS corporate_requests (
  id SERIAL PRIMARY KEY,
  company_name VARCHAR(150) NOT NULL,
  contact_person VARCHAR(120) NOT NULL,
  email VARCHAR(150) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  employee_count INTEGER NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  preferred_branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  event_date DATE NOT NULL,
  preferred_time VARCHAR(20) NOT NULL,
  grounds_required INTEGER NOT NULL DEFAULT 1,
  additional_notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_corporate_requests_status_created_at
  ON corporate_requests(status, created_at DESC);
