require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const queryRoutes = require('./routes/query');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware — allow Vite dev server (5173) and production origins
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
    ],
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// Routes
app.use('/api', queryRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'HelpYourself backend is running',
    model: process.env.OLLAMA_MODEL || 'llama3.2:3b',
    timestamp: new Date().toISOString(),
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 HelpYourself backend running on http://localhost:${PORT}`);
  const llmEngine = process.env.GROQ_API_KEY ? 'llama3-8b via Groq API' : 'llama3-8b via Groq API (Unconfigured)';
  console.log(`🧠 LLM Model: ${llmEngine}`);
  console.log(`🗄️  MongoDB: ${process.env.MONGODB_URI}`);
});
