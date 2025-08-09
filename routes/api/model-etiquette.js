const express = require('express');
const router = express.Router();
const db = require('../../config/database');

async function getModel(slug){
  const rows = await db.query('SELECT id FROM models WHERE slug = ? LIMIT 1', [slug]);
  return rows[0];
}

// Header
router.get('/:slug/header', async (req, res) => {
  try{ const m = await getModel(req.params.slug); if(!m) return res.fail(404,'Model not found');
    const rows = await db.query('SELECT page_title, page_subtitle, is_published FROM etiquette_page_header WHERE model_id=? LIMIT 1', [m.id]);
    return res.success({ header: rows[0] || null });
  }catch(e){ return res.fail(500,'Failed to load header', e.message); }
});
router.put('/:slug/header', async (req, res) => {
  try{ const m = await getModel(req.params.slug); if(!m) return res.fail(404,'Model not found');
    const { page_title = null, page_subtitle = null, is_published = null } = req.body || {};
    const rows = await db.query('SELECT id FROM etiquette_page_header WHERE model_id=? LIMIT 1', [m.id]);
    if (rows.length){
      await db.query('UPDATE etiquette_page_header SET page_title = COALESCE(?, page_title), page_subtitle = COALESCE(?, page_subtitle), is_published = COALESCE(?, is_published), updated_at = NOW() WHERE model_id = ?', [page_title, page_subtitle, (is_published===null? null : (is_published?1:0)), m.id]);
    } else {
      await db.query('INSERT INTO etiquette_page_header (model_id, page_title, page_subtitle, is_published) VALUES (?,?,?,?)', [m.id, page_title || 'Etiquette & Guidelines', page_subtitle, is_published?1:0]);
    }
    return res.success({ saved: true });
  }catch(e){ return res.fail(500,'Failed to save header', e.message); }
});

// Sections list
router.get('/:slug/sections', async (req, res) => {
  try{ const m = await getModel(req.params.slug); if(!m) return res.fail(404,'Model not found');
    const sections = await db.query('SELECT * FROM etiquette_sections WHERE model_id=? ORDER BY order_index, id', [m.id]);
    return res.success({ sections });
  }catch(e){ return res.fail(500,'Failed to load sections', e.message); }
});
router.post('/:slug/sections', async (req, res) => {
  try{ const m = await getModel(req.params.slug); if(!m) return res.fail(404,'Model not found');
    const { title, subtitle=null, icon=null, slug=null } = req.body || {};
    if (!title) return res.fail(400, 'title is required');
    const max = await db.query('SELECT COALESCE(MAX(order_index),0) as maxo FROM etiquette_sections WHERE model_id=?', [m.id]);
    const order_index = (max[0]?.maxo || 0) + 1;
    const r = await db.query('INSERT INTO etiquette_sections (model_id, title, subtitle, icon, slug, order_index) VALUES (?,?,?,?,?,?)', [m.id, title, subtitle, icon, slug, order_index]);
    return res.success({ id: r.insertId });
  }catch(e){ return res.fail(500,'Failed to create section', e.message); }
});
router.put('/:slug/sections/:id', async (req, res) => {
  try{ const m = await getModel(req.params.slug); if(!m) return res.fail(404,'Model not found');
    const { id } = req.params;
    const { title, subtitle, icon, slug, is_visible, order_index } = req.body || {};
    await db.query('UPDATE etiquette_sections SET title=COALESCE(?,title), subtitle=COALESCE(?,subtitle), icon=COALESCE(?,icon), slug=COALESCE(?,slug), is_visible=COALESCE(?,is_visible), order_index=COALESCE(?,order_index), updated_at=NOW() WHERE id=? AND model_id=?', [title, subtitle, icon, slug, typeof is_visible==='undefined'? null : (is_visible?1:0), order_index, parseInt(id), m.id]);
    return res.success({ updated: true });
  }catch(e){ return res.fail(500,'Failed to update section', e.message); }
});
router.patch('/:slug/sections/reorder', async (req, res) => {
  try{ const m = await getModel(req.params.slug); if(!m) return res.fail(404,'Model not found');
    const { ids } = req.body || {};
    if (!Array.isArray(ids)) return res.fail(400, 'ids array required');
    for (let i=0;i<ids.length;i++){
      await db.query('UPDATE etiquette_sections SET order_index=? WHERE id=? AND model_id=?', [i, parseInt(ids[i]), m.id]);
    }
    return res.success({ reordered: true });
  }catch(e){ return res.fail(500,'Failed to reorder sections', e.message); }
});
router.delete('/:slug/sections/:id', async (req, res) => {
  try{ const m = await getModel(req.params.slug); if(!m) return res.fail(404,'Model not found');
    const id = parseInt(req.params.id);
    await db.query('DELETE FROM etiquette_items WHERE section_id=?', [id]);
    await db.query('DELETE FROM etiquette_sections WHERE id=? AND model_id=?', [id, m.id]);
    return res.success({ deleted: true });
  }catch(e){ return res.fail(500,'Failed to delete section', e.message); }
});

// Items for a section
router.get('/:slug/sections/:sectionId/items', async (req, res) => {
  try{ const m = await getModel(req.params.slug); if(!m) return res.fail(404,'Model not found');
    const items = await db.query('SELECT * FROM etiquette_items WHERE section_id=? ORDER BY order_index, id', [parseInt(req.params.sectionId)]);
    return res.success({ items });
  }catch(e){ return res.fail(500,'Failed to load items', e.message); }
});
router.post('/:slug/sections/:sectionId/items', async (req, res) => {
  try{ const m = await getModel(req.params.slug); if(!m) return res.fail(404,'Model not found');
    const sectionId = parseInt(req.params.sectionId);
    const { heading, body=null, icon=null } = req.body || {};
    if (!heading) return res.fail(400, 'heading is required');
    const max = await db.query('SELECT COALESCE(MAX(order_index),0) as maxo FROM etiquette_items WHERE section_id=?', [sectionId]);
    const order_index = (max[0]?.maxo || 0) + 1;
    const r = await db.query('INSERT INTO etiquette_items (section_id, heading, body, icon, order_index) VALUES (?,?,?,?,?)', [sectionId, heading, body, icon, order_index]);
    return res.success({ id: r.insertId });
  }catch(e){ return res.fail(500,'Failed to create item', e.message); }
});
router.put('/:slug/items/:itemId', async (req, res) => {
  try{ const m = await getModel(req.params.slug); if(!m) return res.fail(404,'Model not found');
    const itemId = parseInt(req.params.itemId);
    const { heading, body, icon, is_visible, order_index } = req.body || {};
    await db.query('UPDATE etiquette_items SET heading=COALESCE(?,heading), body=COALESCE(?,body), icon=COALESCE(?,icon), is_visible=COALESCE(?,is_visible), order_index=COALESCE(?,order_index), updated_at=NOW() WHERE id=?', [heading, body, icon, typeof is_visible==='undefined'? null : (is_visible?1:0), order_index, itemId]);
    return res.success({ updated: true });
  }catch(e){ return res.fail(500,'Failed to update item', e.message); }
});
router.patch('/:slug/items/reorder', async (req, res) => {
  try{ const { section_id, ids } = req.body || {}; if(!section_id || !Array.isArray(ids)) return res.fail(400,'section_id and ids required');
    for (let i=0;i<ids.length;i++){
      await db.query('UPDATE etiquette_items SET order_index=? WHERE id=? AND section_id=?', [i, parseInt(ids[i]), parseInt(section_id)]);
    }
    return res.success({ reordered: true });
  }catch(e){ return res.fail(500,'Failed to reorder items', e.message); }
});
router.delete('/:slug/items/:itemId', async (req, res) => {
  try{ await db.query('DELETE FROM etiquette_items WHERE id=?', [parseInt(req.params.itemId)]); return res.success({ deleted:true }); }
  catch(e){ return res.fail(500,'Failed to delete item', e.message); }
});

// CTAs
router.get('/:slug/ctas', async (req, res) => {
  try{ const m = await getModel(req.params.slug); if(!m) return res.fail(404,'Model not found');
    const ctas = await db.query('SELECT * FROM etiquette_ctas WHERE model_id=? ORDER BY order_index, id', [m.id]);
    return res.success({ ctas });
  }catch(e){ return res.fail(500,'Failed to load ctas', e.message); }
});
router.post('/:slug/ctas', async (req, res) => {
  try{ const m = await getModel(req.params.slug); if(!m) return res.fail(404,'Model not found');
    const { title, body=null, button_text, button_link='contact', custom_url=null } = req.body || {};
    if (!title || !button_text) return res.fail(400,'title and button_text required');
    const max = await db.query('SELECT COALESCE(MAX(order_index),0) as maxo FROM etiquette_ctas WHERE model_id=?', [m.id]);
    const order_index = (max[0]?.maxo || 0) + 1;
    const r = await db.query('INSERT INTO etiquette_ctas (model_id, title, body, button_text, button_link, custom_url, order_index) VALUES (?,?,?,?,?,?,?)', [m.id, title, body, button_text, button_link, custom_url, order_index]);
    return res.success({ id: r.insertId });
  }catch(e){ return res.fail(500,'Failed to create cta', e.message); }
});
router.put('/:slug/ctas/:id', async (req, res) => {
  try{ const m = await getModel(req.params.slug); if(!m) return res.fail(404,'Model not found');
    const id = parseInt(req.params.id);
    const { title, body, button_text, button_link, custom_url, is_visible, order_index } = req.body || {};
    await db.query('UPDATE etiquette_ctas SET title=COALESCE(?,title), body=COALESCE(?,body), button_text=COALESCE(?,button_text), button_link=COALESCE(?,button_link), custom_url=COALESCE(?,custom_url), is_visible=COALESCE(?,is_visible), order_index=COALESCE(?,order_index), updated_at=NOW() WHERE id=? AND model_id=?', [title, body, button_text, button_link, custom_url, typeof is_visible==='undefined'? null : (is_visible?1:0), order_index, id, m.id]);
    return res.success({ updated: true });
  }catch(e){ return res.fail(500,'Failed to update cta', e.message); }
});
router.delete('/:slug/ctas/:id', async (req, res) => {
  try{ const m = await getModel(req.params.slug); if(!m) return res.fail(404,'Model not found');
    await db.query('DELETE FROM etiquette_ctas WHERE id=? AND model_id=?', [parseInt(req.params.id), m.id]);
    return res.success({ deleted: true });
  }catch(e){ return res.fail(500,'Failed to delete cta', e.message); }
});

module.exports = router;


