const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://mtclpxdfueelrsbmuden.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10Y2xweGRmdWVlbHJzYm11ZGVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NjAwMDYsImV4cCI6MjA5NTIzNjAwNn0.mqBh4ZvqKMtSxmepmqqqxL4eS7Ov02p9m11IhAC1wLM';

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  try {
    // Try to get info about the expedientes table by causing a specific error or fetching the schema via REST
    const res = await fetch(`${supabaseUrl}/rest/v1/expedientes`, {
      method: 'OPTIONS',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    
    if (res.ok) {
      const data = await res.json();
      // Look for the OpenAPI spec or similar, or just try to trigger a detail error
      console.log('OPTIONS fetch successful (might not contain constraints directly)');
    }

    // Try sending garbage to estado to get the full constraint text in the hint?
    const { data: empresa } = await supabase.from('empresas').select('id').limit(1).single();
    const res2 = await supabase.from('expedientes').insert([{ 
      codigo: 'GARBAGE-' + Date.now(), 
      empresa_id: empresa.id,
      estado: 'XYZ' 
    }]);
    
    console.log('Error output for garbage:', JSON.stringify(res2.error, null, 2));

  } catch (e) {
    console.error('Exception caught:', e);
  }
})();
