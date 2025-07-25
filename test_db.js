const db = require('./config/database');

async function checkDatabase() {
  try {
    console.log('Testing database connection...');
    const connected = await db.testConnection();
    if (!connected) {
      console.log('Database connection failed');
      process.exit(1);
    }
    
    console.log('Checking available models...');
    const [models] = await db.execute('SELECT id, name, slug, status FROM models ORDER BY id');
    console.log('Available models:');
    models.forEach(model => {
      console.log(`- ID: ${model.id}, Name: ${model.name}, Slug: ${model.slug}, Status: ${model.status}`);
    });
    
    console.log('\nTesting specific model lookups...');
    const testSlugs = ['escortmodel', 'modelexample', 'camgirl'];
    
    for (const slug of testSlugs) {
      const [testModel] = await db.execute('SELECT * FROM models WHERE slug = ? LIMIT 1', [slug]);
      if (testModel.length > 0) {
        console.log(`✅ Model found for slug '${slug}':`, testModel[0].name);
      } else {
        console.log(`❌ Model NOT found for slug: ${slug}`);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkDatabase();