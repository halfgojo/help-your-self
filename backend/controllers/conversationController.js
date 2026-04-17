/**
 * conversationController.js
 * CRUD operations for conversation sessions.
 */

const Conversation = require('../models/Conversation');

// GET /api/conversations — list all sessions (metadata only)
async function listConversations(req, res) {
  try {
    const conversations = await Conversation.find(
      {},
      {
        conversationId: 1,
        patientName: 1,
        disease: 1,
        location: 1,
        createdAt: 1,
        updatedAt: 1,
        'messages': { $slice: -1 }, // only last message for preview
      }
    )
      .sort({ updatedAt: -1 })
      .limit(50);

    return res.json({ conversations });
  } catch (err) {
    console.error('listConversations error:', err.message);
    return res.status(500).json({ error: 'Failed to list conversations' });
  }
}

// GET /api/conversations/:id — full conversation with messages
async function getConversation(req, res) {
  try {
    const conv = await Conversation.findOne({
      conversationId: req.params.id,
    });

    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    return res.json({ conversation: conv });
  } catch (err) {
    console.error('getConversation error:', err.message);
    return res.status(500).json({ error: 'Failed to get conversation' });
  }
}

// DELETE /api/conversations/:id
async function deleteConversation(req, res) {
  try {
    const result = await Conversation.deleteOne({
      conversationId: req.params.id,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    return res.json({ message: 'Conversation deleted successfully' });
  } catch (err) {
    console.error('deleteConversation error:', err.message);
    return res.status(500).json({ error: 'Failed to delete conversation' });
  }
}

module.exports = { listConversations, getConversation, deleteConversation };
