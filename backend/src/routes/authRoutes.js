const express = require('express');
const authService = require('../services/authService');
const { adminMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/signup', async (req, res) => {
  try {
    const result = await authService.signup(req.body);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(201).json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: 'Signup failed',
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const result = await authService.login(req.body);

    if (!result.success) {
      return res.status(401).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: 'Login failed',
    });
  }
});
router.get('/users', adminMiddleware, async (req, res) => {
  try {
    const users = await authService.getUsers();

    return res.json(users);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: 'Failed to fetch users',
    });
  }
});
router.post('/google', async (req, res) => {
  try {
    const result =
      await authService.googleLogin(req.body);

    return res.json(result);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: 'Google login failed',
    });
  }
});
module.exports = router;
