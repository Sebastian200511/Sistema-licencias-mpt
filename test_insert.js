import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Script started');

const file = fs.readFileSync(path.join(__dirname, 'src', 'supabaseClient.js'), 'utf8');
const urlMatch = file.match(/supabaseUrl\s*=\s*['"]([^'"]+)['"]/);
const keyMatch = file.match(/supabaseAnonKey\s*=\s*['"]([^'"]+)['"]/);

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1]);
  (async () => {
    try {
      console.log('Fetching empresa...');
      const { data: empresa } = await supabase.from('empresas').select('id').limit(1).single();
      console.log('Got empresa', empresa);
      
      console.log('Inserting expediente...');
      const res = await supabase.from('expedientes').insert([{ 
        codigo: 'TEST-' + Date.now(), 
        empresa_id: empresa.id,
        estado: 'En Inspeccion' 
      }]);
      console.log('Insert Result:', JSON.stringify(res.error, null, 2));
    } catch (e) {
      console.error('Exception caught:', e);
    }
    process.exit(0);
  })();
} else {
  console.log('Could not parse config');
}
