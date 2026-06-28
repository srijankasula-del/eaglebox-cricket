const express = require('express');
const bookingService = require('../services/bookingService');
const {
  getEmailTransportConfig,
  testEmailConnection,
} = require('../services/emailService');
const authMiddleware = require('../middleware/authMiddleware');
const { adminMiddleware } = require('../middleware/authMiddleware');

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
router.post('/bookings', authMiddleware, async (req, res) => {
  const requestStart = Date.now();

  try {
    console.log(`BOOKING REQUEST START: ${requestStart}`);
    console.time('BOOKING_REQUEST');
    console.log('BEFORE createBooking');
    const result = await bookingService.createBooking({
      ...req.body,
      user_id: req.user.id,
    });
    console.log('AFTER createBooking');

    if (!result.success) {
      console.timeEnd('BOOKING_REQUEST');
      console.log(`BOOKING REQUEST END (400): ${Date.now() - requestStart}ms`);
      return res.status(400).json({
        error: result.error,
      });
    }

    console.log('BEFORE res.status(201).json');
    console.timeEnd('BOOKING_REQUEST');
    console.log(`BOOKING REQUEST END (201): ${Date.now() - requestStart}ms`);
    return res.status(201).json(result);

  } catch (error) {
    console.error('Booking creation failed:', error);
    console.timeEnd('BOOKING_REQUEST');
    console.log(`BOOKING REQUEST END (500): ${Date.now() - requestStart}ms`);

    return res.status(500).json({
      error: 'Booking creation failed',
    });
  }
});

router.get('/test-email', async (req, res) => {
  try {
    const diagnostics = await testEmailConnection();

    return res.status(diagnostics.connectionSuccess ? 200 : 500).json({
      host: diagnostics.transport.host,
      port: diagnostics.transport.port,
      secure: diagnostics.transport.secure,
      connectionSuccess: diagnostics.connectionSuccess,
      errorCode: diagnostics.errorCode,
      errorMessage: diagnostics.errorMessage,
      transport: getEmailTransportConfig(),
      dns: diagnostics.dns,
    });
  } catch (error) {
    return res.status(500).json({
      host: getEmailTransportConfig().host,
      port: getEmailTransportConfig().port,
      secure: getEmailTransportConfig().secure,
      connectionSuccess: false,
      errorCode: error.code || null,
      errorMessage: error.message || String(error),
      transport: getEmailTransportConfig(),
    });
  }
});

router.post('/check-availability', async (req, res) => {
  try {

    const result = await bookingService.checkAvailability(req.body);

    // Slot available
    if (result.available) {
      return res.json(result);
    }

    // Slot not available -> find another recommendation
    const recommendation =
      await bookingService.findRecommendedSlot(
  req.body.branchId,
  req.body.date,
  req.body.startTime
);

    return res.json({
      available: false,
      error: result.error,
      recommendation,
    });

  } catch (error) {
    console.error('Availability check failed:', error);

    return res.status(400).json({
      error: error.message || 'Availability check failed',
    });
  }
});

 

router.get('/my-bookings', authMiddleware, async (req, res) => {
  try {
    const bookings = await bookingService.getUserBookings(
      req.user.id
    );

    return res.json(bookings);
  } catch (error) {
    console.error('Failed to fetch user bookings:', error);

    return res.status(500).json({
      error: 'Failed to fetch bookings',
    });
  }
});

router.get('/bookings', adminMiddleware, async (req, res) => {
  try {
    const bookings = await bookingService.getBookings();

    return res.json(bookings);
  } catch (error) {
    console.error('Failed to fetch bookings:', error);

    return res.status(500).json({
      error: 'Failed to fetch bookings',
    });
  }
});

router.get('/analytics', adminMiddleware, async (req, res) => {
  try {
    const analytics = await bookingService.getAnalytics();
    return res.json(analytics);
  } catch (error) {
    console.error('Failed to fetch analytics:', error);
    return res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

router.patch('/bookings/:id/status', adminMiddleware, async (req, res) => {
  try {
    const bookingId = Number(req.params.id);

    const { status } = req.body;

    const allowedStatuses = [
      'pending',
      'confirmed',
      'completed',
      'cancelled',
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
      });
    }

    const booking =
      await bookingService.updateBookingStatus(
        bookingId,
        status
      );

    return res.json(booking);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: 'Failed to update booking status',
    });
  }
});

router.get('/bookings-export', adminMiddleware, async (req, res) => {
  try {
    const bookings = await bookingService.getBookingsCsv();
    const headers = [
      'id',
      'customer_name',
      'phone',
      'branch_name',
      'ground_name',
      'booking_date',
      'start_time',
      'end_time',
      'status',
      'payment_status',
      'amount',
      'created_at',
    ];

    const escapeCsv = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = [
      headers.join(','),
      ...bookings.map((booking) => [
        booking.id,
        booking.customer_name,
        booking.phone,
        booking.branch_name,
        booking.ground_name,
        booking.booking_date,
        booking.start_time,
        booking.end_time,
        booking.status,
        booking.payment_status,
        booking.amount,
        booking.created_at,
      ].map(escapeCsv).join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="bookings-export.csv"');
    return res.send(csv);
  } catch (error) {
    console.error('Failed to export bookings:', error);
    return res.status(500).json({ error: 'Failed to export bookings' });
  }
});

router.get('/bookings/:id', adminMiddleware, async (req, res) => {
  try {
    const bookingId = Number(req.params.id);

    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return res.status(400).json({ error: 'Invalid booking id' });
    }

    const booking = await bookingService.getBookingById(bookingId);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    return res.json(booking);
  } catch (error) {
    console.error('Failed to fetch booking:', error);
    return res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

/* -----------------------------
   Cancellation Request Route
------------------------------ */

router.post(
  '/cancellation-request',
  authMiddleware,
  async (req, res) => {
    try {
      const { bookingId, reason } = req.body;

      await bookingService.createCancellationRequest({
        bookingId,
        userId: req.user.id,
        reason,
      });

      return res.json({
        success: true,
      });

    } catch (error) {
      console.error(
        'Cancellation Request Error:',
        error
      );

      return res.status(400).json({
        error: error.message || 'Failed to create request',
      });
    }
  }
);
router.get(
  '/cancellation-requests',
  adminMiddleware,
  async (req, res) => {
    try {
      const requests =
        await bookingService.getCancellationRequests();

      return res.json(requests);
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        error: 'Failed to fetch requests',
      });
    }
  }
);
router.patch(
  '/cancellation-requests/:id/status',
  adminMiddleware,
  async (req, res) => {
    try {
      const requestId = Number(req.params.id);
      const { status } = req.body;

      await bookingService.updateCancellationRequestStatus(
        requestId,
        status
      );

      return res.json({
        success: true,
      });

    } catch (error) {
      console.error(error);

      return res.status(400).json({
        error: error.message || 'Failed to update request',
      });
    }
  }
);

router.post('/corporate-requests', async (req, res) => {
  try {
    const request = await bookingService.createCorporateRequest(req.body);
    return res.status(201).json({ success: true, request });
  } catch (error) {
    console.error('Corporate request creation failed:', error);
    return res.status(400).json({ error: error.message || 'Failed to create request' });
  }
});

router.get('/corporate-requests', adminMiddleware, async (req, res) => {
  try {
    const requests = await bookingService.getCorporateRequests();
    return res.json(requests);
  } catch (error) {
    console.error('Failed to fetch corporate requests:', error);
    return res.status(500).json({ error: 'Failed to fetch corporate requests' });
  }
});

router.patch('/corporate-requests/:id/status', adminMiddleware, async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    const { status } = req.body;

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ error: 'Invalid request id' });
    }

    const updated = await bookingService.updateCorporateRequestStatus(requestId, status);
    return res.json(updated);
  } catch (error) {
    console.error('Failed to update corporate request:', error);
    if (error.code === 'CORPORATE_REQUEST_CONFLICT') {
      return res.status(409).json({
        error: error.message || 'Booking conflict detected',
        conflict: error.conflict || null,
      });
    }

    return res.status(400).json({ error: error.message || 'Failed to update request' });
  }
});
module.exports = router;
