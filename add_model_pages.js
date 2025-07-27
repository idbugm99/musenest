const mysql = require('mysql2/promise');

async function addModelPages() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'musenest'
    });

    try {
        // Get model ID
        const modelSlug = process.argv[2] || 'modelexample';
        const [model] = await connection.execute('SELECT id FROM models WHERE slug = ?', [modelSlug]);
        if (model.length === 0) {
            console.log('Model not found');
            return;
        }
        const modelId = model[0].id;

        // Get core page types
        const [pages] = await connection.execute('SELECT id, name FROM page_types WHERE category = ? AND is_active = true', ['core']);

        console.log(`Adding core pages for ${modelSlug}...`);
        for (const page of pages) {
            try {
                await connection.execute(
                    'INSERT INTO model_enabled_pages (model_id, page_type_id, is_enabled, sort_order) VALUES (?, ?, true, ?)',
                    [modelId, page.id, page.id]
                );
                console.log(`✅ Added ${page.name} page`);
            } catch (err) {
                if (err.code !== 'ER_DUP_ENTRY') {
                    console.error(`❌ Error adding ${page.name}:`, err.message);
                } else {
                    console.log(`⚠️  ${page.name} already exists`);
                }
            }
        }

        // Also add theme set if missing
        console.log('\nChecking theme set...');
        const [themeSet] = await connection.execute(
            'SELECT id FROM model_theme_sets WHERE model_id = ? AND is_active = true',
            [modelId]
        );

        if (themeSet.length === 0) {
            // Get basic theme set
            const [basicTheme] = await connection.execute(
                'SELECT id FROM theme_sets WHERE name = ? AND is_active = true',
                ['basic']
            );

            if (basicTheme.length > 0) {
                await connection.execute(
                    'INSERT INTO model_theme_sets (model_id, theme_set_id, is_active, applied_at) VALUES (?, ?, true, NOW())',
                    [modelId, basicTheme[0].id]
                );
                console.log('✅ Added basic theme set');
            }
        } else {
            console.log('⚠️  Theme set already exists');
        }

    } finally {
        await connection.end();
    }
}

addModelPages().catch(console.error);