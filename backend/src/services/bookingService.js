const pool = require('../config/db');
const {
  sendBookingConfirmationEmail,
  sendCancellationRequestSubmittedEmail,
  sendCancellationApprovedEmail,
  sendCancellationRejectedEmail,
  sendAdminNotificationEmail,
} = require('./emailService');

function toMinutes(value) {
  const [hours, minutes] = String(value).slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
}

function overlaps(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function isValidTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value).slice(0, 5));
}

function normalizeDate(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function validateSlot({ branchId, date, startTime, endTime }) {
  const normalizedDate = normalizeDate(date);
  const numericBranchId = Number(branchId);

  if (!Number.isInteger(numericBranchId) || numericBranchId <= 0) {
    throw new Error('Invalid branch');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    throw new Error('Invalid booking date');
  }

  if (!isValidTime(startTime) || !isValidTime(endTime)) {
    throw new Error('Invalid booking time');
  }

  const requestedStart = toMinutes(startTime);
  const requestedEnd = toMinutes(endTime);

  if (requestedStart < 600 || requestedEnd > 1320 || requestedStart >= requestedEnd) {
    throw new Error('Please choose a valid slot between 10:00 AM and 10:00 PM');
  }

  return {
    branchId: numericBranchId,
    date: normalizedDate,
    startTime: String(startTime).slice(0, 5),
    endTime: String(endTime).slice(0, 5),
    requestedStart,
    requestedEnd,
  };
}

async function getBookingEmailDetails(bookingId) {
  const { rows } = await pool.query(
    `
    SELECT
      b.id,
      b.customer_name,
      b.booking_date,
      b.start_time,
      b.end_time,
      b.status,
      b.created_at,
      br.branch_name,
      g.ground_name,
      u.email
    FROM bookings b
    LEFT JOIN branches br
      ON br.id = b.branch_id
    LEFT JOIN grounds g
      ON g.id = b.ground_id
    LEFT JOIN users u
      ON u.id = b.user_id
    WHERE b.id = $1
    `,
    [bookingId]
  );

  return rows[0] || null;
}

async function getBranches() {
  const { rows } = await pool.query(
    'SELECT id, branch_name, location FROM branches ORDER BY id'
  );

  return rows;
}

async function getGroundsByBranch(branchId) {
  const { rows } = await pool.query(
    'SELECT id, ground_name FROM grounds WHERE branch_id = $1 ORDER BY id',
    [branchId]
  );

  return rows;
}

async function checkAvailability({
  branchId,
  date,
  startTime,
  endTime,
}, db = pool) {
  const slot = validateSlot({ branchId, date, startTime, endTime });

  const { rows: grounds } = await db.query(
    'SELECT id, ground_name FROM grounds WHERE branch_id = $1 ORDER BY id',
    [slot.branchId]
  );

  if (grounds.length === 0) {
    return {
      available: false,
      error: 'No grounds are configured for this branch',
    };
  }

  const { rows: bookings } = await db.query(
    `
    SELECT ground_id, start_time, end_time
    FROM bookings
    WHERE branch_id = $1
    AND booking_date = $2
    AND status NOT IN ('cancelled')
    `,
    [slot.branchId, slot.date]
  );

  for (const ground of grounds) {
    const hasConflict = bookings.some((booking) => {
      if (booking.ground_id !== ground.id) {
        return false;
      }

      return overlaps(
        slot.requestedStart,
        slot.requestedEnd,
        toMinutes(booking.start_time),
        toMinutes(booking.end_time)
      );
    });

    if (!hasConflict) {
      return {
        available: true,
        groundId: ground.id,
        groundName: ground.ground_name,
      };
    }
  }

  return {
  available: false,
  error: "All grounds are booked for this time slot",
};
}
async function createBooking({
  customer_name,
  phone,
  branch_id,
  booking_date,
  start_time,
  end_time,
  user_id,
}) {
  const slot = validateSlot({
    branchId: branch_id,
    date: booking_date,
    startTime: start_time,
    endTime: end_time,
  });

  const trimmedName = String(customer_name || '').trim();
  const trimmedPhone = String(phone || '').trim();

  if (!trimmedName) {
    return { success: false, error: 'Customer name is required' };
  }

  if (!/^[0-9+\-\s()]{7,20}$/.test(trimmedPhone)) {
    return { success: false, error: 'Please enter a valid phone number' };
  }

  const client = await pool.connect();
  let insertedBooking;

  try {
    await client.query('BEGIN');

    console.log('BEFORE LOCK');
    await client.query(
      'SELECT pg_advisory_xact_lock($1, $2)',
      [slot.branchId, Number(slot.date.replace(/-/g, ''))]
    );
    console.log('AFTER LOCK');

    console.log('BEFORE AVAILABILITY');
    const availability = await checkAvailability({
      branchId: slot.branchId,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
    }, client);
    console.log('AFTER AVAILABILITY');

    if (!availability.available) {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: availability.error,
      };
    }

    const amount =
      ((slot.requestedEnd - slot.requestedStart) / 60) * 800;

    console.log('BEFORE INSERT');
    const result = await client.query(
      `
      INSERT INTO bookings
      (
        customer_name,
        phone,
        branch_id,
        ground_id,
        booking_date,
        start_time,
        end_time,
        status,
        payment_status,
        payment_method,
        amount,
        payment_date,
        user_id,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,
        'confirmed',
        'paid',
        'UPI',
        $8,
        NOW(),
        $9,
        NOW()
      )
      RETURNING id, created_at
      `,
      [
        trimmedName,
        trimmedPhone,
        slot.branchId,
        availability.groundId,
        slot.date,
        slot.startTime,
        slot.endTime,
        amount,
        user_id,
      ]
    );
    console.log('AFTER INSERT');

    console.log('BEFORE COMMIT');
    await client.query('COMMIT');
    console.log('AFTER COMMIT');

    insertedBooking = {
      id: result.rows[0].id,
      createdAt: result.rows[0].created_at,
      availability,
      amount,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  setImmediate(() => {
    (async () => {
      try {
        console.log('BEFORE EMAIL DETAILS');
        const details = await getBookingEmailDetails(insertedBooking.id);
        console.log('AFTER EMAIL DETAILS');

        if (details?.email) {
          console.log('BEFORE EMAIL SEND');
          await sendBookingConfirmationEmail({
            customerEmail: details.email,
            customerName: details.customer_name,
            bookingId: details.id,
            branchName: details.branch_name,
            groundName: details.ground_name,
            bookingDate: details.booking_date,
            startTime: details.start_time,
            endTime: details.end_time,
            createdAt: details.created_at,
          });
          console.log('AFTER EMAIL SEND');
        }
      } catch (emailError) {
        console.error(
          "BOOKING EMAIL ERROR:",
          emailError
        );
      }
    })();
  });
  return {
  success: true,
  booking: {
    id: insertedBooking.id,
    customerName: trimmedName,
    phone: trimmedPhone,
    branchId: slot.branchId,
    groundId: insertedBooking.availability.groundId,
    groundName: insertedBooking.availability.groundName,
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    status: "confirmed",
    paymentStatus: "paid",
    paymentMethod: "UPI",
    amount: insertedBooking.amount,
    createdAt: insertedBooking.createdAt,
  },
};
}
async function getBookings() {
  const { rows } = await pool.query(
    `
    SELECT
  b.id,
  b.customer_name,
  b.phone,
  b.booking_date,
  b.start_time,
  b.end_time,
  b.status,
b.payment_status,
b.payment_method,
b.amount,
b.payment_date,
  br.branch_name,
  g.ground_name
    FROM bookings b
    LEFT JOIN branches br
      ON br.id = b.branch_id
    LEFT JOIN grounds g
      ON g.id = b.ground_id
    ORDER BY
      b.booking_date DESC,
      b.start_time DESC
    `
  );

  return rows;
}

async function getUserBookings(userId) {
  const { rows } = await pool.query(
    `
SELECT
    b.id,
    b.booking_date,
    b.start_time,
    b.end_time,
    b.status,
    b.payment_status,
    b.payment_method,
    b.amount,
    b.payment_date,

    br.branch_name,
    g.ground_name,

    EXISTS (
        SELECT 1
        FROM feedback f
        WHERE f.booking_id = b.id
    ) AS feedback_submitted

FROM bookings b

LEFT JOIN branches br
ON br.id = b.branch_id

LEFT JOIN grounds g
ON g.id = b.ground_id

WHERE b.user_id = $1

ORDER BY
b.booking_date DESC,
b.start_time DESC
`,
    [userId]
  );

  return rows;
}
  async function updateBookingStatus(
  bookingId,
  status
) {
  const existingBooking = await pool.query(
    `
    SELECT *
    FROM bookings
    WHERE id = $1
    `,
    [bookingId]
  );

  if (existingBooking.rows.length === 0) {
    throw new Error("Booking not found");
  }

  const currentStatus = existingBooking.rows[0].status;

  if (
    currentStatus === "completed" ||
    currentStatus === "cancelled"
  ) {
    throw new Error(
      "This booking is locked and cannot be modified"
    );
  }

  const result = await pool.query(
    `
    UPDATE bookings
    SET status = $1
    WHERE id = $2
    RETURNING *
    `,
    [status, bookingId]
  );

  return result.rows[0];
}
async function createCancellationRequest({
  bookingId,
  userId,
  reason,
}) {
  const trimmedReason = String(reason || '').trim();

  if (!Number.isInteger(Number(bookingId)) || Number(bookingId) <= 0) {
    throw new Error('Invalid booking');
  }

  if (!trimmedReason) {
    throw new Error('Cancellation reason is required');
  }

  const bookingResult = await pool.query(
    `
    SELECT id, status
    FROM bookings
    WHERE id = $1
      AND user_id = $2
    `,
    [bookingId, userId]
  );

  const booking = bookingResult.rows[0];

  if (!booking) {
    throw new Error('Booking not found');
  }

  if (booking.status !== 'confirmed') {
    throw new Error('Only confirmed bookings can be cancelled');
  }

  const existingRequest = await pool.query(
    `
    SELECT id
    FROM cancellation_requests
    WHERE booking_id = $1
      AND status = 'pending'
    `,
    [bookingId]
  );

  if (existingRequest.rows.length > 0) {
    throw new Error('A cancellation request is already pending for this booking');
  }

  const result = await pool.query(
    `
    INSERT INTO cancellation_requests
    (
      booking_id,
      user_id,
      reason,
      status
    )
    VALUES
    (
      $1,$2,$3,'pending'
    )
    RETURNING *
    `,
    [
      bookingId,
      userId,
      trimmedReason,
    ]
  );

  try {
    const details = await getBookingEmailDetails(bookingId);

    if (details?.email) {
      const emailDetails = {
        customerEmail: details.email,
        customerName: details.customer_name,
        bookingId,
        branchName: details.branch_name,
        groundName: details.ground_name,
        bookingDate: details.booking_date,
        startTime: details.start_time,
        endTime: details.end_time,
        createdAt: details.created_at,
        reason: trimmedReason,
      };

      await sendCancellationRequestSubmittedEmail(emailDetails);
      await sendAdminNotificationEmail(emailDetails);
    }
  } catch (emailError) {
    console.error("CANCELLATION REQUEST EMAIL ERROR:", emailError);
  }

  return result.rows[0];
}

async function getCancellationRequests() {
  const { rows } = await pool.query(
    `
    SELECT
      cr.id,
      cr.booking_id,
      cr.reason,
      cr.status,
      cr.created_at,

      b.customer_name,
      b.phone,
      b.booking_date,
      b.start_time,
      b.end_time,

      br.branch_name,
      g.ground_name

    FROM cancellation_requests cr

LEFT JOIN bookings b
  ON b.id = cr.booking_id

LEFT JOIN branches br
  ON br.id = b.branch_id

LEFT JOIN grounds g
  ON g.id = b.ground_id

WHERE cr.status = 'pending'

ORDER BY
  cr.created_at DESC
    `
  );

  return rows;
}
async function updateCancellationRequestStatus(
  requestId,
  status
) {
  if (!['approved', 'rejected'].includes(status)) {
    throw new Error('Invalid cancellation status');
  }

  const requestResult = await pool.query(
    `
    UPDATE cancellation_requests
    SET status = $1
    WHERE id = $2
      AND status = 'pending'
    RETURNING *
    `,
    [status, requestId]
  );

  const request = requestResult.rows[0];

  if (!request) {
    throw new Error("Request not found");
  }

  if (status === "approved") {
    await pool.query(
      `
      UPDATE bookings
      SET
  status = 'cancelled',
  payment_status = 'refunded'
      WHERE id = $1
      `,
      [request.booking_id]
    );
  }

  try {
    const details = await getBookingEmailDetails(request.booking_id);

    if (details?.email) {
      const emailDetails = {
        customerEmail: details.email,
        customerName: details.customer_name,
        bookingId: request.booking_id,
        branchName: details.branch_name,
        groundName: details.ground_name,
        bookingDate: details.booking_date,
        startTime: details.start_time,
        endTime: details.end_time,
        createdAt: details.created_at,
      };

      if (status === "approved") {
        await sendCancellationApprovedEmail(emailDetails);
      }

      if (status === "rejected") {
        await sendCancellationRejectedEmail(emailDetails);
      }
    }
  } catch (emailError) {
    console.error("CANCELLATION STATUS EMAIL ERROR:", emailError);
  }

  return request;
}
async function findRecommendedSlot(
  branchId,
  date,
  requestedStartTime
) {
  const todaySlots = [];

for (let hour = 10; hour < 22; hour++) {
  todaySlots.push([
    `${String(hour).padStart(2, "0")}:00`,
    `${String(hour + 1).padStart(2, "0")}:00`,
  ]);
}

  // Find which slot the user requested
  const startIndex = todaySlots.findIndex(
    ([start]) => start === requestedStartTime
  );

  // Check ONLY later slots today
  for (
    let i = startIndex + 1;
    i < todaySlots.length;
    i++
  ) {
    const [startTime, endTime] = todaySlots[i];

    const availability = await checkAvailability({
      branchId,
      date,
      startTime,
      endTime,
    });

    if (availability.available) {
      return {
        branchId,
        date,
        groundId: availability.groundId,
        groundName: availability.groundName,
        startTime,
        endTime,
      };
    }
  }

  // No later slot today → check tomorrow
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const nextDate = tomorrow.toISOString().split("T")[0];

  for (const [startTime, endTime] of todaySlots) {
    const availability = await checkAvailability({
      branchId,
      date: nextDate,
      startTime,
      endTime,
    });

    if (availability.available) {
      return {
        branchId,
        date: nextDate,
        groundId: availability.groundId,
        groundName: availability.groundName,
        startTime,
        endTime,
      };
    }
  }

  return null;
}
module.exports = {
  getBranches,
  getGroundsByBranch,
  checkAvailability,
  findRecommendedSlot,
  createBooking,
  getBookings,
  getUserBookings,
  updateBookingStatus,
  createCancellationRequest,
  getCancellationRequests,
  updateCancellationRequestStatus,
};
