const express = require('express');
const router = express.Router();

// Consolidated sysadmin API surface
// This aggregates existing routers under a single, consistent namespace.
// Legacy mounts remain available for backward compatibility.

router.use('/system', require('./system-management'));
router.use('/business', require('./admin-business'));
router.use('/models', require('./admin-models'));
router.use('/ai-servers', require('./ai-server-management'));
router.use('/media-review', require('./media-review-queue'));
router.use('/site-configuration', require('./site-configuration'));
router.use('/model-dashboard', require('./model-dashboard'));

module.exports = router;


