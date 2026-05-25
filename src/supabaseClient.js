import { createClient } from '@supabase/supabase-js'


const supabaseUrl = 'https://mtclpxdfueelrsbmuden.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10Y2xweGRmdWVlbHJzYm11ZGVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NjAwMDYsImV4cCI6MjA5NTIzNjAwNn0.mqBh4ZvqKMtSxmepmqqqxL4eS7Ov02p9m11IhAC1wLM'

export const supabase = createClient(supabaseUrl, supabaseKey)