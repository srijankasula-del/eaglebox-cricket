const express = require('express');
const bookingService = require('../services/bookingService');

const router = express.Router();

router.get('/branches', async (req, res) => {
  try {
    const branches = await bookingService.getBranches();
    res.json(branches);
  } catch (error) {
    console.error('Failed to fetch branches:', error);
    res.status(500).json({ error: 'Failed to fetch branches' });
  }
});

router.get('/grounds/:branchId', async (req, res) => {
  const branchId = Number(req.params.branchId);

  if (!Number.isInteger(branchId) || branchId <= 0) {
    return res.status(400).json({ error: 'Invalid branchId' });
  }

  try {
    const grounds = await bookingService.getGroundsByBranch(branchId);
    return res.json(grounds);
  } catch (error) {
    console.error('Failed to fetch grounds:', error);
    return res.status(500).json({ error: 'Failed to fetch grounds' });
  }
});

router.post('/check-availability', async (req, res) => {
  try {
    const result = await bookingService.checkAvailability(req.body || {});
    res.json(result);
  } catch (error) {
    console.error('Availability check failed:', error);
    res.status(500).json({ error: 'Availability check failed' });
  }
});

router.post('/bookings', async (req, res) => {
  try {
    const result = await bookingService.createBooking(req.body || {});
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    return res.status(201).json(result);
  } catch (error) {
    console.error('Booking creation failed:', error);
    return res.status(500).json({ error: 'Booking creation failed' });
  }
});

router.get('/bookings', async (req, res) => {
  try {
    const bookings = await bookingService.getBookings();
    res.json(bookings);
  } catch (error) {
    console.error('Failed to fetch bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

module.exports = router;
