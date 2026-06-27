-- Migration: Add user_id to bookings table
-- This migration links bookings to users

ALTER TABLE bookings ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

-- Add index for faster queries
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
