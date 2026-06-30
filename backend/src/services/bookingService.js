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

function to12HourLabel(timeValue) {
  const [hoursRaw, minutesRaw] = String(timeValue).slice(0, 5).split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const normalizedHour = hours % 12 || 12;

  return `${normalizedHour}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function parseCorporateTimeRange(value) {
  const text = String(value || '').trim();
  const parts = text.split(/\s*-\s*/).map((part) => part.trim()).filter(Boolean);

  if (parts.length < 2) {
    throw new Error('Preferred time must include a start and end time');
  }

  const parseTimePart = (part, assumeStart = false) => {
    const match = part.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) {
      throw new Error('Preferred time must be in a valid range format');
    }

    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const period = (match[3] || '').toUpperCase();

    if (period === 'PM' && hour < 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    if (!period && assumeStart && hour < 10) hour += 12;

    return {
      time24: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      label: `${to12HourLabel(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)}`,
    };
  };

  const start = parseTimePart(parts[0], true);
  const end = parseTimePart(parts[1], false);

  return {
    startTime: start.time24,
    endTime: end.time24,
    label: `${start.label} - ${end.label}`,
  };
}

async function getCorporateRequestAvailability(requestId) {
  const requestResult = await pool.query(
    `
    SELECT cr.*, b.branch_name
    FROM corporate_requests cr
    LEFT JOIN branches b ON b.id = cr.preferred_branch_id
    WHERE cr.id = $1
    `,
    [requestId]
  );

  const request = requestResult.rows[0];

  if (!request) {
    throw new Error('Corporate request not found');
  }

  const timeRange = parseCorporateTimeRange(request.preferred_time);

  const { rows: grounds } = await pool.query(
    `
    SELECT id, ground_name
    FROM grounds
    WHERE branch_id = $1
    ORDER BY id
    `,
    [request.preferred_branch_id]
  );

  const { rows: conflicts } = await pool.query(
    `
    SELECT
      b.id AS booking_id,
      b.customer_name,
      b.phone AS customer_phone,
      b.booking_date,
      b.start_time,
      b.end_time,
      b.ground_id
    FROM bookings b
    WHERE b.branch_id = $1
      AND b.booking_date = $2
      AND b.status IN ('confirmed', 'completed')
      AND (b.start_time < $4 AND b.end_time > $3)
    `,
    [request.preferred_branch_id, request.event_date, timeRange.startTime, timeRange.endTime]
  );

  const occupiedGroundIds = new Set(conflicts.map((booking) => booking.ground_id));
  const availableGrounds = grounds.map((ground) => {
    const conflict = conflicts.find((booking) => booking.ground_id === ground.id);
    return {
      id: ground.id,
      ground_name: ground.ground_name,
      available: !occupiedGroundIds.has(ground.id),
      conflict: conflict
        ? {
            booking_id: conflict.booking_id,
            customer_name: conflict.customer_name,
            customer_phone: conflict.customer_phone,
            booking_date: conflict.booking_date,
            booking_time: `${to12HourLabel(conflict.start_time)} - ${to12HourLabel(conflict.end_time)}`,
          }
        : null,
    };
  });

  return {
    request: {
      ...request,
      requested_time_label: timeRange.label,
    },
    availableGrounds,
  };
}

async function findCorporateRequestConflict({
  preferredBranchId,
  eventDate,
  preferredTime,
  groundId,
}) {
  const timeRange = parseCorporateTimeRange(preferredTime);

  const { rows } = await pool.query(
    `
    SELECT
      b.id AS booking_id,
      b.customer_name,
      b.phone AS customer_phone,
      b.booking_date,
      b.start_time,
      b.end_time,
      br.branch_name,
      g.ground_name
    FROM bookings b
      LEFT JOIN branches br
        ON br.id = b.branch_id
      LEFT JOIN grounds g
        ON g.id = b.ground_id
      WHERE b.branch_id = $1
        AND ($5::int IS NULL OR b.ground_id = $5)
        AND b.booking_date = $2
        AND b.status IN ('confirmed', 'completed')
        AND (
          b.start_time < $4
          AND b.end_time > $3
      )
    ORDER BY b.start_time ASC
    LIMIT 1
    `,
      [
        preferredBranchId,
        eventDate,
        timeRange.startTime,
        timeRange.endTime,
        groundId || null,
      ]
    );

  const conflict = rows[0];

  if (!conflict) {
    return {
      conflict: false,
      timeRange,
    };
  }

  return {
    conflict: true,
    timeRange,
    booking: {
      booking_id: conflict.booking_id,
      customer_name: conflict.customer_name,
      customer_phone: conflict.customer_phone,
      branch_name: conflict.branch_name,
      ground_name: conflict.ground_name,
      booking_date: conflict.booking_date,
      booking_time: `${to12HourLabel(conflict.start_time)} - ${to12HourLabel(conflict.end_time)}`,
    },
  };
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
  const t0 = Date.now();
  let lastMark = t0;

  const logElapsed = (label) => {
    const now = Date.now();
    console.log(`BOOKING TIMING ${label}: ${now - lastMark}ms (total ${now - t0}ms)`);
    lastMark = now;
  };

  if (!trimmedName) {
    return { success: false, error: 'Customer name is required' };
  }

  if (!/^[0-9+\-\s()]{7,20}$/.test(trimmedPhone)) {
    return { success: false, error: 'Please enter a valid phone number' };
  }

  console.log(`BOOKING TIMING START: ${t0}`);
  const client = await pool.connect();
  logElapsed('AFTER pool.connect()');
  let insertedBooking;

  try {
    await client.query('BEGIN');

    console.log('BEFORE LOCK');
    await client.query(
      'SELECT pg_advisory_xact_lock($1, $2)',
      [slot.branchId, Number(slot.date.replace(/-/g, ''))]
    );
    console.log('AFTER LOCK');
    logElapsed('AFTER pg_advisory_xact_lock()');

    console.log('BEFORE AVAILABILITY');
    const availability = await checkAvailability({
      branchId: slot.branchId,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
    }, client);
    console.log('AFTER AVAILABILITY');
    logElapsed('AFTER checkAvailability()');

    if (!availability.available) {
      await client.query('ROLLBACK');
      logElapsed('AFTER ROLLBACK (unavailable)');
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
    logElapsed('AFTER INSERT');

    console.log('BEFORE COMMIT');
    await client.query('COMMIT');
    console.log('AFTER COMMIT');
    logElapsed('AFTER COMMIT');

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
        console.log(`BOOKING TIMING AFTER getBookingEmailDetails(): ${Date.now() - t0}ms total`);

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
  console.log(`BOOKING TIMING TOTAL createBooking(): ${Date.now() - t0}ms`);
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
    b.created_at,
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
  b.created_at DESC,
  b.booking_date DESC,
  b.start_time DESC,
  b.id DESC
LIMIT 100
`,
    [userId]
  );

  return rows;
}

async function updateBookingStatus(bookingId, status) {
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

  if (currentStatus === "completed" || currentStatus === "cancelled") {
    throw new Error("This booking is locked and cannot be modified");
  }

  // FIX: Validate legal state transitions
  const validTransitions = {
    'pending': ['confirmed', 'cancelled'],
    'confirmed': ['completed', 'cancelled'],
    'completed': [],  // locked
    'cancelled': []   // locked
  };

  if (!validTransitions[currentStatus]?.includes(status)) {
    throw new Error(
      `Invalid status transition from '${currentStatus}' to '${status}'. ` +
      `Allowed transitions: ${validTransitions[currentStatus].join(', ') || 'none (locked)'}`
    );
  }

  const result = await pool.query(
    `
    UPDATE bookings
    SET status = $1,
        updated_at = NOW()
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

async function updateCancellationRequestStatus(requestId, status) {
  if (!['approved', 'rejected'].includes(status)) {
    throw new Error('Invalid cancellation status');
  }

  const client = await pool.connect();
  let request = null;

  try {
    await client.query('BEGIN');

    const requestResult = await client.query(
      `
      SELECT *
      FROM cancellation_requests
      WHERE id = $1
      FOR UPDATE
      `,
      [requestId]
    );

    request = requestResult.rows[0];

    if (!request || request.status !== 'pending') {
      throw new Error("Request not found");
    }

    await client.query(
      `
      UPDATE cancellation_requests
      SET status = $1
      WHERE id = $2
      `,
      [status, requestId]
    );

    if (status === "approved") {
      await client.query(
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

    await client.query('COMMIT');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('CANCELLATION STATUS ROLLBACK ERROR:', rollbackError);
    }

    throw error;
  } finally {
    client.release();
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

  return {
    id: Number(requestId),
    status,
  };
}

async function createCorporateRequest(payload) {
  const companyName = String(payload.company_name || payload.companyName || '').trim();
  const contactPerson = String(payload.contact_person || payload.contactPerson || '').trim();
  const email = String(payload.email || '').trim();
  const phone = String(payload.phone || payload.phoneNumber || '').trim();
  const employeeCount = Number(payload.employee_count || payload.employeeCount);
  const eventType = String(payload.event_type || payload.eventType || '').trim();
  const preferredBranchId = Number(payload.preferred_branch_id || payload.preferredBranchId);
  const eventDate = normalizeDate(payload.event_date || payload.eventDate);
  const preferredTime = String(payload.preferred_time || payload.preferredTime || '').trim();
  const groundsRequired = Number(payload.grounds_required || payload.groundsRequired || 1);
  const groundId = payload.ground_id ? Number(payload.ground_id) : null;
  const additionalNotes = String(payload.additional_notes || payload.additionalNotes || '').trim();

  const allowedEventTypes = [
    'Team Outing',
    'Tournament',
    'Employee Engagement',
    'Practice Session',
  ];

  if (!companyName) throw new Error('Company name is required');
  if (!contactPerson) throw new Error('Contact person is required');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Please enter a valid email address');
  if (!/^[0-9+\-\s()]{7,20}$/.test(phone)) throw new Error('Please enter a valid phone number');
  if (!Number.isInteger(employeeCount) || employeeCount <= 0) throw new Error('Employee count is required');
  if (!allowedEventTypes.includes(eventType)) throw new Error('Please choose a valid event type');
  if (!Number.isInteger(preferredBranchId) || preferredBranchId <= 0) throw new Error('Please select a preferred branch');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) throw new Error('Please choose a valid event date');
  if (!preferredTime) throw new Error('Preferred time is required');
  if (!Number.isInteger(groundsRequired) || groundsRequired <= 0) throw new Error('Number of grounds required is required');

  const { rows } = await pool.query(
    `
    INSERT INTO corporate_requests (
      company_name,
      contact_person,
      email,
      phone,
      employee_count,
      event_type,
      preferred_branch_id,
      event_date,
      preferred_time,
      grounds_required,
      ground_id,
      additional_notes,
      status
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending')
    RETURNING *
    `,
    [
      companyName,
      contactPerson,
      email,
      phone,
      employeeCount,
      eventType,
      preferredBranchId,
      eventDate,
      preferredTime,
      groundsRequired,
      groundId,
      additionalNotes || null,
    ]
  );

  return rows[0];
}

async function getGroundAvailabilityForCorporateRequest(requestId) {
  return getCorporateRequestAvailability(requestId);
}

async function getCorporateRequests() {
  const { rows } = await pool.query(
    `
    SELECT
      cr.*,
      b.branch_name,
      g.ground_name AS assigned_ground_name
    FROM corporate_requests cr
    LEFT JOIN branches b
      ON b.id = cr.preferred_branch_id
    LEFT JOIN grounds g
      ON g.id = cr.ground_id
    ORDER BY cr.created_at DESC
    `
  );

  return rows;
}

async function updateCorporateRequestStatus(requestId, status, options = {}) {
  console.log(`[CORPORATE_REQUEST] Start approval: requestId=${requestId}, status=${status}, options=${JSON.stringify(options)}`);

  if (!['pending', 'approved', 'rejected'].includes(status)) {
    throw new Error('Invalid corporate request status');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log(`[CORPORATE_REQUEST] Transaction started`);

    const requestResult = await client.query(
      `
      SELECT *
      FROM corporate_requests
      WHERE id = $1
      FOR UPDATE
      `,
      [requestId]
    );

    const existingRequest = requestResult.rows[0];

    if (!existingRequest) {
      throw new Error('Corporate request not found');
    }

    console.log(`[CORPORATE_REQUEST] Found request: id=${existingRequest.id}, status=${existingRequest.status}, ground_id=${existingRequest.ground_id}`);

    if (status === 'approved') {
      const requestedGroundId = options.groundId ?? existingRequest.ground_id;
      console.log(`[CORPORATE_REQUEST] Approving with groundId=${requestedGroundId}`);

      if (!requestedGroundId) {
        console.log(`[CORPORATE_REQUEST] ERROR: No ground assigned`);
        const error = new Error('Ground assignment required before approval.');
        error.code = 'GROUND_ASSIGNMENT_REQUIRED';
        throw error;
      }

      // FIX: Validate ground exists and belongs to branch BEFORE acquiring lock
      const groundResult = await client.query(
        `
        SELECT id, branch_id
        FROM grounds
        WHERE id = $1
        `,
        [requestedGroundId]
      );

      const ground = groundResult.rows[0];

      if (!ground) {
        console.log(`[CORPORATE_REQUEST] ERROR: Ground not found: groundId=${requestedGroundId}`);
        throw new Error('Ground not found');
      }

      if (Number(ground.branch_id) !== Number(existingRequest.preferred_branch_id)) {
        console.log(`[CORPORATE_REQUEST] ERROR: Ground branch mismatch. Ground branch=${ground.branch_id}, Request branch=${existingRequest.preferred_branch_id}`);
        throw new Error('Selected ground does not belong to the requested branch');
      }

      // FIX: Check conflict BEFORE acquiring lock to avoid lock collisions
      console.log(`[CORPORATE_REQUEST] Checking conflicts for: branch=${existingRequest.preferred_branch_id}, date=${existingRequest.event_date}, time=${existingRequest.preferred_time}, ground=${requestedGroundId}`);

      const conflictResult = await findCorporateRequestConflict({
        preferredBranchId: existingRequest.preferred_branch_id,
        eventDate: existingRequest.event_date,
        preferredTime: existingRequest.preferred_time,
        groundId: requestedGroundId,
      });

      if (conflictResult.conflict) {
        console.log(`[CORPORATE_REQUEST] CONFLICT DETECTED:`, JSON.stringify(conflictResult.booking));
        const error = new Error('Booking conflict detected for this corporate request.');
        error.code = 'CORPORATE_REQUEST_CONFLICT';
        error.conflict = conflictResult.booking;
        error.timeRange = conflictResult.timeRange;
        throw error;
      }

      // FIX: Use unique lock key combining branch AND ground AND date
      const lockKeyDate = Number(existingRequest.event_date.replace(/-/g, ''));
      const lockKey1 = Number(existingRequest.preferred_branch_id);
      const lockKey2 = Number(requestedGroundId) * 10000 + (lockKeyDate % 10000);

      console.log(`[CORPORATE_REQUEST] Acquiring advisory lock: lockKey1=${lockKey1}, lockKey2=${lockKey2}`);
      
      await client.query(
        'SELECT pg_advisory_xact_lock($1, $2)',
        [lockKey1, lockKey2]
      );

      // Recheck conflict after lock acquired (double-check pattern)
      console.log(`[CORPORATE_REQUEST] Rechecking conflicts after lock acquisition`);
      const recheckConflict = await findCorporateRequestConflict({
        preferredBranchId: existingRequest.preferred_branch_id,
        eventDate: existingRequest.event_date,
        preferredTime: existingRequest.preferred_time,
        groundId: requestedGroundId,
      });

      if (recheckConflict.conflict) {
        console.log(`[CORPORATE_REQUEST] CONFLICT DETECTED ON RECHECK:`, JSON.stringify(recheckConflict.booking));
        const error = new Error('Booking conflict detected for this corporate request.');
        error.code = 'CORPORATE_REQUEST_CONFLICT';
        error.conflict = recheckConflict.booking;
        error.timeRange = recheckConflict.timeRange;
        throw error;
      }

      console.log(`[CORPORATE_REQUEST] No conflicts found, updating status to approved`);

      const updatedRequest = await client.query(
        `
        UPDATE corporate_requests
        SET ground_id = $1, status = 'approved', updated_at = NOW()
        WHERE id = $2
        RETURNING *
        `,
        [requestedGroundId, requestId]
      );

      await client.query('COMMIT');
      console.log(`[CORPORATE_REQUEST] SUCCESS: Request approved with ground assignment`);
      return updatedRequest.rows[0];
    }

    // Rejection or other status
    console.log(`[CORPORATE_REQUEST] Updating status to ${status}`);

    const { rows } = await client.query(
      `
      UPDATE corporate_requests
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [status, requestId]
    );

    await client.query('COMMIT');
    console.log(`[CORPORATE_REQUEST] SUCCESS: Status updated to ${status}`);

    if (!rows[0]) {
      throw new Error('Corporate request not found');
    }

    return rows[0];
  } catch (error) {
    console.error(`[CORPORATE_REQUEST] ERROR: ${error.message}`, error);
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('CORPORATE REQUEST ROLLBACK ERROR:', rollbackError);
    }

    throw error;
  } finally {
    client.release();
  }
}

async function assignCorporateRequestGround(requestId, groundId) {
  const numericRequestId = Number(requestId);
  const numericGroundId = Number(groundId);

  if (!Number.isInteger(numericRequestId) || numericRequestId <= 0) {
    throw new Error('Invalid corporate request id');
  }

  if (!Number.isInteger(numericGroundId) || numericGroundId <= 0) {
    throw new Error('Invalid ground id');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const requestResult = await client.query(
      `SELECT * FROM corporate_requests WHERE id = $1 FOR UPDATE`,
      [numericRequestId]
    );

    const request = requestResult.rows[0];

    if (!request) {
      throw new Error('Corporate request not found');
    }

    const groundResult = await client.query(
      `
      SELECT id, branch_id, ground_name
      FROM grounds
      WHERE id = $1
      `,
      [numericGroundId]
    );

    const ground = groundResult.rows[0];

    if (!ground) {
      throw new Error('Ground not found');
    }

    if (Number(ground.branch_id) !== Number(request.preferred_branch_id)) {
      throw new Error('Selected ground does not belong to the requested branch');
    }

    const { rows } = await client.query(
      `
      UPDATE corporate_requests
      SET ground_id = $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [numericGroundId, numericRequestId]
    );

    await client.query('COMMIT');

    return rows[0];
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('CORPORATE ASSIGNMENT ROLLBACK ERROR:', rollbackError);
    }

    throw error;
  } finally {
    client.release();
  }
}

async function getAnalytics() {
  const [totalBookings, todaysBookings, confirmedBookings, cancelledBookings, corporateRequests, revenue] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS count FROM bookings'),
    pool.query('SELECT COUNT(*)::int AS count FROM bookings WHERE booking_date = CURRENT_DATE'),
    pool.query("SELECT COUNT(*)::int AS count FROM bookings WHERE status = 'confirmed'"),
    pool.query("SELECT COUNT(*)::int AS count FROM bookings WHERE status = 'cancelled'"),
    pool.query('SELECT COUNT(*)::int AS count FROM corporate_requests'),
    pool.query("SELECT COALESCE(SUM(amount), 0)::numeric AS total FROM bookings WHERE payment_status = 'paid'"),
  ]);

  return {
    totalBookings: totalBookings.rows[0].count,
    todaysBookings: todaysBookings.rows[0].count,
    confirmedBookings: confirmedBookings.rows[0].count,
    cancelledBookings: cancelledBookings.rows[0].count,
    corporateRequests: corporateRequests.rows[0].count,
    totalRevenue: Number(revenue.rows[0].total || 0),
  };
}

async function getBookingById(bookingId) {
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
      b.created_at,
      br.branch_name,
      g.ground_name
    FROM bookings b
    LEFT JOIN branches br
      ON br.id = b.branch_id
    LEFT JOIN grounds g
      ON g.id = b.ground_id
    WHERE b.id = $1
    `,
    [bookingId]
  );

  return rows[0] || null;
}

async function getBookingsCsv() {
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
      b.amount,
      b.created_at,
      br.branch_name,
      g.ground_name
    FROM bookings b
    LEFT JOIN branches br
      ON br.id = b.branch_id
    LEFT JOIN grounds g
      ON g.id = b.ground_id
    ORDER BY b.created_at DESC
    `
  );

  return rows;
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
  createCorporateRequest,
  getCorporateRequests,
  updateCorporateRequestStatus,
  getAnalytics,
  getBookingById,
  getBookingsCsv,
  getGroundAvailabilityForCorporateRequest,
  assignCorporateRequestGround,
};
