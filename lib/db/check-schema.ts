import { client } from './drizzle';

async function checkSchema() {
  try {
    console.log('Checking database schema...');
    
    // Check which tables exist
    const tables = await client`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    
    console.log('Existing tables:');
    tables.forEach(table => console.log(`  - ${table.table_name}`));
    
    // Check for specific tables we need
    const requiredTables = [
      'profiles',
      'virtual_keys', 
      'usage_logs',
      'transactions',
      'system_alerts',
      'monitoring_logs'
    ];
    
    console.log('\nRequired tables status:');
    for (const tableName of requiredTables) {
      const exists = tables.some(t => t.table_name === tableName);
      console.log(`  - ${tableName}: ${exists ? '✅ EXISTS' : '❌ MISSING'}`);
    }
    
    // Check virtual_keys columns
    console.log('\nChecking virtual_keys columns...');
    try {
      const columns = await client`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'virtual_keys' AND table_schema = 'public'
        ORDER BY column_name
      `;
      
      console.log('virtual_keys columns:');
      columns.forEach(col => console.log(`  - ${col.column_name}: ${col.data_type}`));
      
      const hasLitellmKeyId = columns.some(c => c.column_name === 'litellm_key_id');
      console.log(`\nlitellm_key_id column: ${hasLitellmKeyId ? '✅ EXISTS' : '❌ MISSING'}`);
      
    } catch (error) {
      console.log('virtual_keys table does not exist or cannot be accessed');
    }
    
  } catch (error) {
    console.error('Error checking schema:', error);
  } finally {
    process.exit(0);
  }
}

checkSchema();
