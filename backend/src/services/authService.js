const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID
);

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined. Please set it in backend/.env');
}

async function signup({ full_name, email, phone, password }) {
  const existingUser = await pool.query(
    'SELECT id FROM users WHERE email = $1',
    [email]
  );

  if (existingUser.rows.length > 0) {
    return {
      success: false,
      error: 'Email already registered',
    };
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const result = await pool.query(
    `INSERT INTO users
    (full_name, email, phone, password, role)
    VALUES ($1,$2,$3,$4,'customer')
    RETURNING id, full_name, email, role`,
    [full_name, email, phone, hashedPassword]
  );

  return {
    success: true,
    user: result.rows[0],
  };
}
async function googleLogin({ credential }) {
  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  const email = payload.email;
  const full_name = payload.name;

  let userResult = await pool.query(
    `SELECT * FROM users WHERE email = $1`,
    [email]
  );

  let user;

  if (userResult.rows.length === 0) {
    const fallbackPassword = await bcrypt.hash(
      crypto.randomBytes(32).toString('hex'),
      10
    );

    const createdUser = await pool.query(
      `
      INSERT INTO users
      (full_name,email,password,role)
      VALUES ($1,$2,$3,'customer')
      RETURNING *
      `,
      [full_name, email, fallbackPassword]
    );

    user = createdUser.rows[0];
  } else {
    user = userResult.rows[0];
  }

  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
      email: user.email,
    },
    JWT_SECRET,
    {
      expiresIn: '7d',
    }
  );

  return {
    success: true,
    token,
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
    },
  };
}

async function login({ email, password }) {
  const result = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );

  if (result.rows.length === 0) {
    return {
      success: false,
      error: 'Invalid email or password',
    };
  }

  const user = result.rows[0];

  const validPassword = await bcrypt.compare(
    password,
    user.password
  );

  if (!validPassword) {
    return {
      success: false,
      error: 'Invalid email or password',
    };
  }

  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
      email: user.email,
    },
    JWT_SECRET,
    {
      expiresIn: '7d',
    }
  );

  return {
    success: true,
    token,
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
    },
  };
}
async function getUsers() {
  const result = await pool.query(
    `
    SELECT
      id,
      full_name,
      email,
      phone,
      role,
      created_at
    FROM users
    ORDER BY id DESC
    `
  );

  return result.rows;
}

module.exports = {
  signup,
  login,
  googleLogin,
  getUsers,
};
