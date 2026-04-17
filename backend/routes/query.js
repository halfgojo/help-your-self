/**
 * routes/query.js
 * All API routes for HelpYourself.
 */

const express = require('express');
const router = express.Router();

const { handleQuery, handleQueryStream } = require('../controllers/queryController');
const {
  listConversations,
  getConversation,
  deleteConversation,
} = require('../controllers/conversationController');

// Main query endpoint — processes medical research queries (bulk JSON)
router.post('/query', handleQuery);

// Streaming query endpoint
router.post('/query-stream', handleQueryStream);

// Conversation management
router.get('/conversations', listConversations);
router.get('/conversations/:id', getConversation);
router.delete('/conversations/:id', deleteConversation);

module.exports = router;
