const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const authRoutes = require('./routes/auth');
const calendarRoutes = require('./routes/calendar');
const trackerRoutes = require('./routes/tracker');
const sharesRoutes = require('./routes/shares');

const app = express();
const isProd = process.env.NODE_ENV === 'production';
const PORT = isProd ? (process.env.PORT || 5000) : 3001;

app.use(cors({ 
  origin: 'https://schedule-app-blue-sigma.vercel.app', 
  credentials: true 
}));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/tracker', trackerRoutes);
app.use('/api/shares', sharesRoutes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API server running on port ${PORT} [${isProd ? 'production' : 'development'}]`);
});
