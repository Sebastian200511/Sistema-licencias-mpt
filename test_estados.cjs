const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://mtclpxdfueelrsbmuden.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10Y2xweGRmdWVlbHJzYm11ZGVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NjAwMDYsImV4cCI6MjA5NTIzNjAwNn0.mqBh4ZvqKMtSxmepmqqqxL4eS7Ov02p9m11IhAC1wLM';

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  try {
    const { data: empresa } = await supabase.from('empresas').select('id').limit(1).single();
    
    for (let estado of ['Observado', 'Rechazado', 'Subsanacion', 'Aprobado']) {
        const res = await supabase.from('expedientes').insert([{ 
          codigo: 'TEST-' + estado + '-' + Date.now(), 
          empresa_id: empresa.id,
          estado: estado 
        }]);
        console.log(`Res ${estado}:`, JSON.stringify(res.error || 'Success', null, 2));
    }
  } catch (e) {
    console.error('Exception caught:', e);
  }
})();
