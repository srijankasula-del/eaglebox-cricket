const pool = require('../config/db');

function toMinutes(value) {
  const [hours, minutes] = String(value).split(':').map(Number);
  return hours * 60 + minutes;
}

function overlaps(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

async function getBranches() {
  const { rows } = await pool.query('SELECT id, branch_name, location FROM branches ORDER BY id');
  return rows;
}

async function getGroundsByBranch(branchId) {
  const { rows } = await pool.query('SELECT id, ground_name FROM grounds WHERE branch_id = $1 ORDER BY id', [branchId]);
  return rows;
}

async function checkAvailability({ branchId, date, startTime, endTime }) {
  const { rows: grounds } = await pool.query('SELECT id, ground_name FROM grounds WHERE branch_id = $1 ORDER BY id', [branchId]);
  const { rows: bookings } = await pool.query(
    `SELECT ground_id, start_time, end_time
     FROM bookings
     WHERE branch_id = $1 AND booking_date = $2 AND status <> 'cancelled'`,
    [branchId, date]
  );

  const requestedStart = toMinutes(startTime);
  const requestedEnd = toMinutes(endTime);

  for (const ground of grounds) {
    const hasConflict = bookings.some((booking) => {
      if (booking.ground_id !== ground.id) return false;
      return overlaps(requestedStart, requestedEnd, toMinutes(booking.start_time), toMinutes(booking.end_time));
    });

    if (!hasConflict) {
      return {
        available: true,
        groundId: ground.id,
        groundName: ground.ground_name,
      };
    }
  }

  return { available: false, message: 'No Grounds Available' };
}

async function createBooking({ name, phone, branchId, date, startTime, endTime }) {
  const availability = await checkAvailability({ branchId, date, startTime, endTime });
  if (!availability.available) {
    return { success: false, error: availability.message };
  }

  const result = await pool.query(
    `INSERT INTO bookings (customer_name, phone, branch_id, ground_id, booking_date, start_time, end_time, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'confirmed', NOW()) RETURNING id`,
    [name, phone, branchId, availability.groundId, date, startTime, endTime]
  );

  return {
    success: true,
    booking: {
      id: result.rows[0].id,
      customerName: name,
      phone,
      branchId,
      groundId: availability.groundId,
      groundName: availability.groundName,
      date,
      startTime,
      endTime,
      status: 'confirmed',
    },
  };
}

async function getBookings() {
  const { rows } = await pool.query(
    `SELECT b.id, b.customer_name, b.phone, b.booking_date, b.start_time, b.end_time, b.status,
            br.branch_name AS branch_name,
            g.ground_name AS ground_name
     FROM bookings b
     LEFT JOIN branches br ON br.id = b.branch_id
     LEFT JOIN grounds g ON g.id = b.ground_id
     ORDER BY b.booking_date DESC, b.start_time DESC`
  );
  return rows;
}

module.exports = {
  getBranches,
  getGroundsByBranch,
  checkAvailability,
  createBooking,
  getBookings,
};
