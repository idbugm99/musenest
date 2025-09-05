const express = require('express');
const router = express.Router();
const axios = require('axios');

// Data dump utility - fetches all model data and returns as CSV format
router.get('/:modelSlug/dump', async (req, res) => {
    try {
        const { modelSlug } = req.params;
        const { format = 'csv', images = false } = req.query;
        const includeImages = images === 'true' || images === '1';
        
        // Base URL for internal API calls
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        
        const results = [];
        
        // Helper function to add CSV line
        function addLine(page, field, value) {
            const v = (value !== null && typeof value === 'object') ? JSON.stringify(value) : String(value || '');
            results.push(`${page}, ${field}, "${v.replace(/"/g, '""')}"`);
        }
        
        // Deep object walker to flatten nested structures
        function* entriesDeep(obj, prefix = '') {
            if (obj === null || typeof obj !== 'object') return;
            
            if (Array.isArray(obj)) {
                for (let i = 0; i < obj.length; i++) {
                    const p = prefix ? `${prefix}[${i}]` : `[${i}]`;
                    if (obj[i] !== null && typeof obj[i] === 'object') {
                        yield* entriesDeep(obj[i], p);
                    } else {
                        yield [p, obj[i]];
                    }
                }
            } else {
                for (const [k, v] of Object.entries(obj)) {
                    const p = prefix ? `${prefix}.${k}` : k;
                    if (v !== null && typeof v === 'object') {
                        if (Array.isArray(v) && v.every(x => x === null || typeof x !== 'object')) {
                            yield [p, v];
                        } else {
                            yield* entriesDeep(v, p);
                        }
                    } else {
                        yield [p, v];
                    }
                }
            }
        }
        
        // Helper to make API calls
        async function fetchData(path) {
            try {
                const response = await axios.get(`${baseUrl}${path}`, {
                    headers: { Accept: 'application/json' },
                    timeout: 10000
                });
                return response.data;
            } catch (error) {
                console.error(`Error fetching ${path}:`, error.message);
                return { error: error.message };
            }
        }
        
        // Add CSV header
        results.push('Page, Field, Value');
        
        console.log(`Starting data dump for model: ${modelSlug}`);
        
        // 1. HOME CONTENT
        console.log('Fetching home content...');
        try {
            const homeData = await fetchData(`/api/model-home/${modelSlug}/home`);
            if (homeData.error) {
                addLine('Home', 'error', homeData.error);
            } else {
                const data = homeData.data || homeData;
                for (const [k, v] of entriesDeep(data)) {
                    addLine('Home', k, v);
                }
            }
        } catch (e) {
            addLine('Home', 'fetch_error', e.message);
        }
        
        // 2. GALLERY SECTIONS
        console.log('Fetching gallery sections...');
        try {
            const galleryData = await fetchData(`/api/model-gallery/${modelSlug}/sections?page=1&limit=100`);
            if (galleryData.error) {
                addLine('Gallery', 'error', galleryData.error);
            } else {
                const sections = galleryData.data?.sections || [];
                sections.forEach((section) => {
                    const sectionBase = `Section(${section.id}${section.title ? `:${section.title}` : ''})`;
                    for (const [k, v] of entriesDeep(section)) {
                        addLine('Gallery', `${sectionBase}.${k}`, v);
                    }
                });
                
                // Optionally fetch images for each section
                if (includeImages) {
                    console.log('Fetching gallery images...');
                    for (const section of sections) {
                        try {
                            const imagesData = await fetchData(`/api/model-gallery/${modelSlug}/sections/${section.id}/images?page=1&limit=100`);
                            if (imagesData.error) {
                                addLine('GalleryImages', `Section(${section.id}).error`, imagesData.error);
                            } else {
                                const images = imagesData.images || [];
                                images.forEach((image) => {
                                    const imageBase = `Section(${section.id}).Image(${image.id || image.filename})`;
                                    for (const [k, v] of entriesDeep(image)) {
                                        addLine('GalleryImages', `${imageBase}.${k}`, v);
                                    }
                                });
                            }
                        } catch (e) {
                            addLine('GalleryImages', `Section(${section.id}).fetch_error`, e.message);
                        }
                    }
                }
            }
        } catch (e) {
            addLine('Gallery', 'fetch_error', e.message);
        }
        
        // 3. CALENDAR
        console.log('Fetching calendar data...');
        try {
            const calendarData = await fetchData(`/api/model-calendar/${modelSlug}`);
            if (calendarData.error) {
                addLine('Calendar', 'error', calendarData.error);
            } else {
                // Add basic calendar info
                ['timezone', 'currentMonth', 'currentYear'].forEach(field => {
                    if (calendarData.data?.[field] !== undefined) {
                        addLine('Calendar', field, calendarData.data[field]);
                    }
                });
                
                // Add periods if they exist
                const periods = calendarData.data?.periods || [];
                periods.forEach((period) => {
                    const periodBase = `Period(${period.id})`;
                    for (const [k, v] of entriesDeep(period)) {
                        addLine('Calendar', `${periodBase}.${k}`, v);
                    }
                });
                
                // Add calendar grid data
                if (calendarData.data?.calendar) {
                    for (const [k, v] of entriesDeep(calendarData.data.calendar)) {
                        addLine('CalendarGrid', k, v);
                    }
                }
            }
        } catch (e) {
            addLine('Calendar', 'fetch_error', e.message);
        }
        
        // 4. RATES
        console.log('Fetching rates data...');
        try {
            const ratesData = await fetchData(`/api/model-rates/${modelSlug}`);
            if (ratesData.error) {
                addLine('Rates', 'error', ratesData.error);
            } else {
                const groups = ['incall', 'outcall', 'extended', 'payment', 'additional'];
                groups.forEach(group => {
                    const items = ratesData[group] || [];
                    items.forEach((item) => {
                        const itemBase = `${group.toUpperCase()}(${item.id || 'row'})`;
                        for (const [k, v] of entriesDeep(item)) {
                            addLine('Rates', `${itemBase}.${k}`, v);
                        }
                    });
                });
                
                // Get rates page content
                try {
                    const ratesPageData = await fetchData(`/api/model-rates/${modelSlug}/page-content`);
                    if (ratesPageData.error) {
                        addLine('RatesPageContent', 'error', ratesPageData.error);
                    } else {
                        for (const [k, v] of entriesDeep(ratesPageData)) {
                            addLine('RatesPageContent', k, v);
                        }
                    }
                } catch (e) {
                    addLine('RatesPageContent', 'fetch_error', e.message);
                }
            }
        } catch (e) {
            addLine('Rates', 'fetch_error', e.message);
        }
        
        // 5. ETIQUETTE
        console.log('Fetching etiquette data...');
        try {
            // Try legacy endpoint first
            const etiquetteData = await fetchData(`/api/model-etiquette/${modelSlug}/content`);
            if (etiquetteData.error) {
                addLine('Etiquette', 'error', etiquetteData.error);
            } else {
                // Extract data from legacy format
                const data = etiquetteData.data || etiquetteData;
                for (const [k, v] of entriesDeep(data)) {
                    addLine('Etiquette', k, v);
                }
            }
        } catch (e) {
            addLine('Etiquette', 'fetch_error', e.message);
        }
        
        // 6. CONTACT (try both legacy and new endpoints)
        console.log('Fetching contact data...');
        try {
            // Try legacy endpoint first
            let contactData = await fetchData(`/api/model-contact/${modelSlug}/content`);
            if (contactData.error) {
                // Try alternative endpoint
                // Fallback not needed with new clean API
            }
            
            if (contactData.error) {
                addLine('Contact', 'error', contactData.error);
            } else {
                for (const [k, v] of entriesDeep(contactData)) {
                    addLine('Contact', k, v);
                }
            }
        } catch (e) {
            addLine('Contact', 'fetch_error', e.message);
        }
        
        // 7. ABOUT
        console.log('Fetching about content...');
        try {
            const aboutData = await fetchData(`/api/model-about/${modelSlug}/about`);
            if (aboutData.error) {
                addLine('About', 'error', aboutData.error);
            } else {
                const data = aboutData.data || aboutData;
                for (const [k, v] of entriesDeep(data)) {
                    addLine('About', k, v);
                }
            }
        } catch (e) {
            addLine('About', 'fetch_error', e.message);
        }
        
        // 8. TESTIMONIALS
        console.log('Fetching testimonials...');
        try {
            const testimonialsData = await fetchData(`/api/model-testimonials/${modelSlug}`);
            if (testimonialsData.error) {
                addLine('Testimonials', 'error', testimonialsData.error);
            } else {
                const testimonials = testimonialsData.data?.testimonials || [];
                testimonials.forEach((testimonial) => {
                    const testimonialBase = `Testimonial(${testimonial.id || 'row'})`;
                    for (const [k, v] of entriesDeep(testimonial)) {
                        addLine('Testimonials', `${testimonialBase}.${k}`, v);
                    }
                });
            }
        } catch (e) {
            addLine('Testimonials', 'fetch_error', e.message);
        }
        
        console.log(`Data dump completed for ${modelSlug}`);
        
        // Return results
        if (format === 'json') {
            res.json({
                success: true,
                model: modelSlug,
                includeImages,
                lines: results.length - 1, // subtract header
                data: results
            });
        } else {
            // Return as CSV
            res.set({
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="data-dump-${modelSlug}-${new Date().toISOString().split('T')[0]}.csv"`
            });
            res.send(results.join('\n'));
        }
        
    } catch (error) {
        console.error('Data dump error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;