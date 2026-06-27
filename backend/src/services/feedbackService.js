const pool = require("../config/db");

// Submit Feedback
async function createFeedback({
  bookingId,
  userId,
  rating,
  review,
}) {
  // Check booking exists
  const bookingResult = await pool.query(
    `
    SELECT *
    FROM bookings
    WHERE id = $1
      AND user_id = $2
    `,
    [bookingId, userId]
  );

  if (bookingResult.rows.length === 0) {
    throw new Error("Booking not found");
  }

  const booking = bookingResult.rows[0];

  // Allow feedback only after completed booking
  if (booking.status !== "completed") {
    throw new Error(
      "Feedback can only be submitted for completed bookings."
    );
  }

  // Prevent duplicate feedback
  const existing = await pool.query(
    `
    SELECT id
    FROM feedback
    WHERE booking_id = $1
    `,
    [bookingId]
  );

  if (existing.rows.length > 0) {
    throw new Error(
      "Feedback already submitted for this booking."
    );
  }

  const result = await pool.query(
    `
    INSERT INTO feedback
    (
      booking_id,
      user_id,
      rating,
      review
    )
    VALUES
    (
      $1,$2,$3,$4
    )
    RETURNING *
    `,
    [
      bookingId,
      userId,
      rating,
      review,
    ]
  );

  return result.rows[0];
}

// Admin - View All Feedback
async function getAllFeedback() {
  const { rows } = await pool.query(`
SELECT
    f.id,
    f.rating,
    f.review,
    f.created_at,

    u.full_name,

    b.booking_date,

    br.branch_name,

    g.ground_name

FROM feedback f

JOIN users u
ON u.id = f.user_id

JOIN bookings b
ON b.id = f.booking_id

JOIN branches br
ON br.id = b.branch_id

JOIN grounds g
ON g.id = b.ground_id

ORDER BY f.created_at DESC
`);

  return rows;
}

// User - My Feedback
async function getMyFeedback(userId) {
  const { rows } = await pool.query(
    `
    SELECT
      f.id,
      f.rating,
      f.review,
      f.created_at,

      b.booking_date,

      g.ground_name,

      br.branch_name

    FROM feedback f

    LEFT JOIN bookings b
      ON b.id = f.booking_id

    LEFT JOIN grounds g
      ON g.id = b.ground_id

    LEFT JOIN branches br
      ON br.id = b.branch_id

    WHERE f.user_id = $1

    ORDER BY
      f.created_at DESC
    `,
    [userId]
  );

  return rows;
}

module.exports = {
  createFeedback,
  getAllFeedback,
  getMyFeedback,
};