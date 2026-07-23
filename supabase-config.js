// supabase-config.js
// এই ফাইলটা তোমার index.html, admin.html, app.js এর সাথে একই ফোল্ডারে (root এ) রাখবে

// Supabase JS লাইব্রেরি CDN থেকে import করা হচ্ছে
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = "https://pvxowurhtumxyedgezyg.supabase.co";
const SUPABASE_KEY = "sb_publishable_cTjhayZgxlFjfm9x9aVRew_WrO9_dEm";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export { supabase };
