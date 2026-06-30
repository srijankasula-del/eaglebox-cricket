-- Migration: Add missing columns to bookings table and fix status handling
-- Date: 2026-06-30

-- Add payment_method column if missing
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30) DEFAULT 'UPI';

-- Add payment_date if missing
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add updated_at column for tracking modifications
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create index for faster queries on status and created_at
CREATE INDEX IF NOT EXISTS idx_bookings_status_created
  ON bookings(status, created_at DESC);

-- Create index for user_id to speed up user bookings queries
CREATE INDEX IF NOT EXISTS idx_bookings_user_id_created
  ON bookings(user_id, created_at DESC);
