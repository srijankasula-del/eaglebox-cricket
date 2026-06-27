const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const connectionString = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined. Please set it in backend/.env');
}

if (!jwtSecret) {
  throw new Error('JWT_SECRET is not defined. Please set it in backend/.env');
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  connect: () => pool.connect(),
  end: () => pool.end(),
};
