require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bookingRoutes = require('./src/routes/bookingRoutes');
const db = require('./src/config/db');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'eaglebox-booking-api' });
});

app.use('/api', bookingRoutes);

app.use((error, req, res, next) => {
  console.error('Unhandled server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

async function startServer() {
  try {
    await db.query('SELECT NOW()');
    console.log('PostgreSQL connection successful');

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Eagle Box booking API running on port ${PORT}`);
    });
  } catch (error) {
    console.error('PostgreSQL connection failed:', error.message);
    process.exit(1);
  }
}

startServer();