const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All template routes require authentication
router.use(authenticateToken);

// GET /api/templates - List all templates for the current user
router.get('/', (req, res) => {
  try {
    const templates = db.prepare('SELECT * FROM settings_templates WHERE user_id = ? ORDER BY updated_at DESC')
      .all(req.user.id);
    res.json(templates.map(t => ({
      id: t.id,
      name: t.name,
      settings: JSON.parse(t.settings || '{}'),
      createdAt: t.created_at,
      updatedAt: t.updated_at
    })));
  } catch (err) {
    console.error('List templates error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/templates - Create a new template
router.post('/', (req, res) => {
  try {
    const { name, settings } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Template name is required' });
    }
    const id = uuidv4();
    db.prepare('INSERT INTO settings_templates (id, user_id, name, settings) VALUES (?, ?, ?, ?)')
      .run(id, req.user.id, name.trim(), JSON.stringify(settings || {}));
    const template = db.prepare('SELECT * FROM settings_templates WHERE id = ?').get(id);
    res.status(201).json({
      id: template.id,
      name: template.name,
      settings: JSON.parse(template.settings || '{}'),
      createdAt: template.created_at,
      updatedAt: template.updated_at
    });
  } catch (err) {
    console.error('Create template error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/templates/:id - Update a template
router.put('/:id', (req, res) => {
  try {
    const template = db.prepare('SELECT * FROM settings_templates WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    const { name, settings } = req.body;
    db.prepare('UPDATE settings_templates SET name = ?, settings = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(name || template.name, JSON.stringify(settings || JSON.parse(template.settings)), req.params.id);
    const updated = db.prepare('SELECT * FROM settings_templates WHERE id = ?').get(req.params.id);
    res.json({
      id: updated.id,
      name: updated.name,
      settings: JSON.parse(updated.settings || '{}'),
      createdAt: updated.created_at,
      updatedAt: updated.updated_at
    });
  } catch (err) {
    console.error('Update template error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/templates/:id - Delete a template
router.delete('/:id', (req, res) => {
  try {
    const template = db.prepare('SELECT * FROM settings_templates WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    db.prepare('DELETE FROM settings_templates WHERE id = ?').run(req.params.id);
    res.json({ message: 'Template deleted' });
  } catch (err) {
    console.error('Delete template error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
