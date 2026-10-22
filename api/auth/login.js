/**
 * Vercel Serverless Function - Login Endpoint
 * /api/auth/login
 *
 * Interviewer accounts:
 * - Primary admin: ADMIN_EMAIL + ADMIN_PASSWORD_HASH env vars.
 * - Additional interviewers: ADMIN_USERS env var, a JSON array of
 *   { "email": "...", "passwordHash": "<bcrypt hash>" } entries.
 * Anyone on the combined list can log in as an interviewer (isAdmin).
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Primary admin credentials (use environment variables in production)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const JWT_SECRET = process.env.JWT_SECRET;

// Build the full list of interviewer accounts: primary admin + ADMIN_USERS.
function getInterviewerUsers() {
  const users = [];
  if (ADMIN_EMAIL && ADMIN_PASSWORD_HASH) {
    users.push({ email: ADMIN_EMAIL, passwordHash: ADMIN_PASSWORD_HASH });
  }
  if (process.env.ADMIN_USERS) {
    try {
      const extra = JSON.parse(process.env.ADMIN_USERS);
      if (Array.isArray(extra)) {
        for (const entry of extra) {
          if (entry && typeof entry.email === 'string' && typeof entry.passwordHash === 'string') {
            users.push({ email: entry.email, passwordHash: entry.passwordHash });
          }
        }
      }
    } catch (e) {
      console.error('Failed to parse ADMIN_USERS environment variable:', e.message);
    }
  }
  return users;
}

// Ensure required environment variables are set
if (!ADMIN_EMAIL || !ADMIN_PASSWORD_HASH || !JWT_SECRET) {
  console.error('Missing required environment variables: ADMIN_EMAIL, ADMIN_PASSWORD_HASH, or JWT_SECRET');
}

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Parse body if it's a string (Vercel sometimes doesn't parse JSON automatically)
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON in request body' });
    }
  }

  const { email, password } = body || {};

  if (!email || !password) {
    return res.status(400).json({
      error: 'Email and password required',
      debug: process.env.NODE_ENV !== 'production' ? {
        bodyType: typeof req.body,
        hasBody: !!req.body,
        hasEmail: !!email,
        hasPassword: !!password
      } : undefined
    });
  }

  try {
    // Find the interviewer account (email match is case-insensitive)
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = getInterviewerUsers().find(
      (u) => u.email.trim().toLowerCase() === normalizedEmail
    );
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password against that account's hash
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      {
        email: user.email,
        isAdmin: true,
        userId: 'admin-' + Date.now()
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      success: true,
      token,
      user: { email: user.email, isAdmin: true }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};
