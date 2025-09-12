const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();

// Database connection
const dbConfig = require('../../config/database');

// Get all conversations with contacts and message counts
router.get('/', async (req, res) => {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // Get conversations with contact info and latest message
    const [conversations] = await connection.execute(`
      SELECT 
        c.id,
        c.subject,
        c.status,
        c.priority,
        c.model_id,
        c.created_at,
        c.updated_at,
        ct.name as contact_name,
        ct.email as contact_email,
        ct.phone as contact_phone,
        ct.preferred_contact,
        COUNT(m.id) as message_count,
        MAX(m.created_at) as last_message_at,
        SUBSTRING(
          (SELECT message FROM messages WHERE conversation_id = c.id ORDER BY created_at ASC LIMIT 1),
          1, 200
        ) as first_message
      FROM conversations c
      LEFT JOIN contacts ct ON c.contact_id = ct.id
      LEFT JOIN messages m ON c.id = m.conversation_id
      GROUP BY c.id, c.subject, c.status, c.priority, c.model_id, c.created_at, c.updated_at,
               ct.name, ct.email, ct.phone, ct.preferred_contact
      ORDER BY c.created_at DESC
    `);
    
    // Format the data for frontend
    const formattedConversations = conversations.map(conv => ({
      id: conv.id,
      subject: conv.subject,
      status: conv.status,
      priority: conv.priority,
      model_id: conv.model_id,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
      contact_name: conv.contact_name,
      contact_email: conv.contact_email,
      contact_phone: conv.contact_phone,
      preferred_contact: conv.preferred_contact,
      message_count: conv.message_count,
      last_message_at: conv.last_message_at,
      message: conv.first_message
    }));

    res.json({
      success: true,
      conversations: formattedConversations,
      total: formattedConversations.length
    });
    
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({
      error: 'Failed to fetch conversations'
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Get single conversation with all messages and consents
router.get('/:id', async (req, res) => {
  let connection;
  const conversationId = parseInt(req.params.id);
  
  if (!conversationId) {
    return res.status(400).json({ error: 'Invalid conversation ID' });
  }
  
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // Get conversation with contact info
    const [conversationData] = await connection.execute(`
      SELECT 
        c.id,
        c.subject,
        c.status,
        c.priority,
        c.model_id,
        c.created_at,
        c.updated_at,
        ct.name as contact_name,
        ct.email as contact_email,
        ct.phone as contact_phone,
        ct.preferred_contact
      FROM conversations c
      LEFT JOIN contacts ct ON c.contact_id = ct.id
      WHERE c.id = ?
    `, [conversationId]);
    
    if (conversationData.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    const conversation = conversationData[0];
    
    // Get all messages for this conversation
    const [messages] = await connection.execute(`
      SELECT 
        id,
        message_type,
        subject,
        message,
        sender_name,
        sender_email,
        sender_phone,
        recipient_name,
        recipient_email,
        recipient_phone,
        is_read,
        is_spam,
        created_at
      FROM messages 
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `, [conversationId]);
    
    // Get consents for the contact
    const [consents] = await connection.execute(`
      SELECT 
        consent_type,
        consent_given,
        created_at
      FROM consents con
      JOIN conversations c ON c.contact_id = con.contact_id
      WHERE c.id = ?
      ORDER BY con.created_at DESC
    `, [conversationId]);
    
    res.json({
      success: true,
      ...conversation,
      messages: messages,
      consents: consents
    });
    
  } catch (error) {
    console.error('Error fetching conversation details:', error);
    res.status(500).json({
      error: 'Failed to fetch conversation details'
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Update conversation status and priority
router.put('/:id', async (req, res) => {
  let connection;
  const conversationId = parseInt(req.params.id);
  const { status, priority, assigned_to } = req.body;
  
  if (!conversationId) {
    return res.status(400).json({ error: 'Invalid conversation ID' });
  }
  
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // Build dynamic update query
    const updates = [];
    const params = [];
    
    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    
    if (priority) {
      updates.push('priority = ?');
      params.push(priority);
    }
    
    if (assigned_to !== undefined) {
      updates.push('assigned_to = ?');
      params.push(assigned_to);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(conversationId);
    
    const query = `UPDATE conversations SET ${updates.join(', ')} WHERE id = ?`;
    
    const [result] = await connection.execute(query, params);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    res.json({
      success: true,
      message: 'Conversation updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating conversation:', error);
    res.status(500).json({
      error: 'Failed to update conversation'
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Bulk update conversations
router.put('/bulk/update', async (req, res) => {
  let connection;
  const { ids, status, priority, assigned_to } = req.body;
  
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Invalid conversation IDs' });
  }
  
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // Build dynamic update query
    const updates = [];
    const params = [];
    
    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    
    if (priority) {
      updates.push('priority = ?');
      params.push(priority);
    }
    
    if (assigned_to !== undefined) {
      updates.push('assigned_to = ?');
      params.push(assigned_to);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    
    const placeholders = ids.map(() => '?').join(',');
    const query = `UPDATE conversations SET ${updates.join(', ')} WHERE id IN (${placeholders})`;
    
    const [result] = await connection.execute(query, [...params, ...ids]);
    
    res.json({
      success: true,
      message: `${result.affectedRows} conversations updated successfully`,
      updated_count: result.affectedRows
    });
    
  } catch (error) {
    console.error('Error bulk updating conversations:', error);
    res.status(500).json({
      error: 'Failed to update conversations'
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Delete conversation (and cascade delete messages)
router.delete('/:id', async (req, res) => {
  let connection;
  const conversationId = parseInt(req.params.id);
  
  if (!conversationId) {
    return res.status(400).json({ error: 'Invalid conversation ID' });
  }
  
  try {
    connection = await mysql.createConnection(dbConfig);
    await connection.beginTransaction();
    
    // Delete messages first (foreign key constraint)
    await connection.execute('DELETE FROM messages WHERE conversation_id = ?', [conversationId]);
    
    // Delete conversation
    const [result] = await connection.execute('DELETE FROM conversations WHERE id = ?', [conversationId]);
    
    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    await connection.commit();
    
    res.json({
      success: true,
      message: 'Conversation deleted successfully'
    });
    
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Error deleting conversation:', error);
    res.status(500).json({
      error: 'Failed to delete conversation'
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Bulk delete conversations
router.delete('/bulk/delete', async (req, res) => {
  let connection;
  const { ids } = req.body;
  
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Invalid conversation IDs' });
  }
  
  try {
    connection = await mysql.createConnection(dbConfig);
    await connection.beginTransaction();
    
    // Delete messages first (foreign key constraint)
    const placeholders = ids.map(() => '?').join(',');
    await connection.execute(`DELETE FROM messages WHERE conversation_id IN (${placeholders})`, ids);
    
    // Delete conversations
    const [result] = await connection.execute(`DELETE FROM conversations WHERE id IN (${placeholders})`, ids);
    
    await connection.commit();
    
    res.json({
      success: true,
      message: `${result.affectedRows} conversations deleted successfully`,
      deleted_count: result.affectedRows
    });
    
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Error bulk deleting conversations:', error);
    res.status(500).json({
      error: 'Failed to delete conversations'
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Mark messages as read
router.put('/:id/read', async (req, res) => {
  let connection;
  const conversationId = parseInt(req.params.id);
  
  if (!conversationId) {
    return res.status(400).json({ error: 'Invalid conversation ID' });
  }
  
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const [result] = await connection.execute(
      'UPDATE messages SET is_read = TRUE WHERE conversation_id = ? AND is_read = FALSE',
      [conversationId]
    );
    
    res.json({
      success: true,
      message: `${result.affectedRows} messages marked as read`,
      updated_count: result.affectedRows
    });
    
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({
      error: 'Failed to mark messages as read'
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Get conversation statistics
router.get('/stats/summary', async (req, res) => {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // Get status counts
    const [statusCounts] = await connection.execute(`
      SELECT 
        status,
        COUNT(*) as count
      FROM conversations 
      GROUP BY status
    `);
    
    // Get priority counts
    const [priorityCounts] = await connection.execute(`
      SELECT 
        priority,
        COUNT(*) as count
      FROM conversations 
      GROUP BY priority
    `);
    
    // Get model counts
    const [modelCounts] = await connection.execute(`
      SELECT 
        COALESCE(model_id, 'General') as model_id,
        COUNT(*) as count
      FROM conversations 
      GROUP BY model_id
    `);
    
    // Get recent activity (last 7 days)
    const [recentActivity] = await connection.execute(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM conversations 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);
    
    res.json({
      success: true,
      stats: {
        status_counts: statusCounts.reduce((acc, row) => {
          acc[row.status] = row.count;
          return acc;
        }, {}),
        priority_counts: priorityCounts.reduce((acc, row) => {
          acc[row.priority] = row.count;
          return acc;
        }, {}),
        model_counts: modelCounts.reduce((acc, row) => {
          acc[row.model_id] = row.count;
          return acc;
        }, {}),
        recent_activity: recentActivity
      }
    });
    
  } catch (error) {
    console.error('Error fetching conversation stats:', error);
    res.status(500).json({
      error: 'Failed to fetch conversation statistics'
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

module.exports = router;