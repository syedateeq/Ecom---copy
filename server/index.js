const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
require('dotenv').config();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `product_${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only jpg, jpeg, png, webp images are allowed'));
  },
});

// Initialize database (creates tables on first run)
const db = require('./db');

// ─── Auto-seed if DB is empty ─────────────────────────────────────────────────
// Render uses an ephemeral filesystem: the SQLite file is wiped on every
// redeploy / dyno restart. We seed automatically on startup when the tables
// are empty so the app always has data without requiring a manual seed step.
(async () => {
  try {
    const productCount = db.prepare('SELECT COUNT(*) as cnt FROM products').get();
    if (productCount.cnt === 0) {
      console.log('📦 Database is empty — running auto-seed...');
      // Dynamically require to avoid circular dependency issues
      const { autoSeed } = require('./seed');
      await autoSeed();
    } else {
      console.log(`📦 Database has ${productCount.cnt} products — skipping seed`);
    }
  } catch (err) {
    console.error('Auto-seed check failed:', err.message);
  }
})();

const app = express();

// Middleware
app.use(cors({
  origin: [
    'https://ecom-copy-t9mb.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
    /\.vercel\.app$/, // allow any vercel preview deployments
  ],
  credentials: true,
}));
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// Health check + DB status (useful for debugging on Render)
app.get('/api/health', (req, res) => {
  try {
    const products = db.prepare('SELECT COUNT(*) as cnt FROM products').get();
    const online = db.prepare('SELECT COUNT(*) as cnt FROM online_prices').get();
    const retailers = db.prepare('SELECT COUNT(*) as cnt FROM retailers').get();
    res.json({
      status: 'ok',
      db: {
        products: products.cnt,
        onlinePrices: online.cnt,
        retailers: retailers.cnt,
      },
      seeded: products.cnt > 0,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/retailer', require('./routes/retailer'));
app.use('/api/stores', require('./routes/stores'));
app.use('/api/discover', require('./routes/nearbyDiscover'));
app.use('/api', require('./routes/compare'));

// Image upload endpoint
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ imageUrl, filename: req.file.filename });
});

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'SmartCart API is running (SQLite)' });
});

// Start scheduled price refresh cron job
const { startPriceRefreshJob } = require('./services/cronJobs');
startPriceRefreshJob();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📦 Database: SQLite (smartcart.db)`);
  console.log(`🔄 Price refresh: every 30 minutes`);
});
