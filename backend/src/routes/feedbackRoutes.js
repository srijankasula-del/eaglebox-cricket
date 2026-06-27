const express = require("express");
const router = express.Router();

const feedbackService = require("../services/feedbackService");
const authMiddleware = require("../middleware/authMiddleware");
const { adminMiddleware } = require("../middleware/authMiddleware");

// Submit Feedback
router.post("/", authMiddleware, async (req, res) => {
  try {
    const feedback = await feedbackService.createFeedback({
      bookingId: req.body.bookingId,
      userId: req.user.id,
      rating: req.body.rating,
      review: req.body.review,
    });

    return res.status(201).json({
      success: true,
      feedback,
    });

  } catch (error) {
    console.error("Feedback Error:", error);

    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Logged-in User Feedback
router.get("/my", authMiddleware, async (req, res) => {
  try {
    const feedback =
      await feedbackService.getMyFeedback(req.user.id);

    return res.json(feedback);

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to fetch feedback",
    });
  }
});

// Admin - View All Feedback
router.get("/", adminMiddleware, async (req, res) => {
  try {
    const feedback =
      await feedbackService.getAllFeedback();

    return res.json(feedback);

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to fetch feedback",
    });
  }
});

module.exports = router;
