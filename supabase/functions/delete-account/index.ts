// Supabase Edge Function: delete-account
//
// Apple App Store Guideline 5.1.1(v) requires in-app account deletion for any
// app that supports account creation. Deleting a Supabase auth user needs the
// service_role key, which must NEVER ship in the client. This function runs
// that privileged operation server-side: it validates the caller's JWT, then
// deletes their rows and their auth account.
//
// Deploy:  supabase functions deploy delete-account
// (verify_jwt stays ON by default, so only authenticated callers reach it.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);
    const jwt = authHeader.replace('Bearer ', '');

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Identity comes from the validated token, never from the request body.
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData.user) return json({ error: 'Invalid token' }, 401);
    const userId = userData.user.id;

    // Delete the user's data first (service_role bypasses RLS), then the
    // auth record. If the tables cascade on auth.users, the deletes are
    // redundant but harmless.
    const { error: daysErr } = await admin.from('days').delete().eq('user_id', userId);
    if (daysErr) throw daysErr;
    const { error: settingsErr } = await admin.from('settings').delete().eq('user_id', userId);
    if (settingsErr) throw settingsErr;

    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) throw delErr;

    return json({ success: true }, 200);
  } catch (err) {
    // Log the detail server-side; return a generic message to the client.
    console.error('[delete-account]', err);
    return json({ error: 'Could not delete account' }, 500);
  }
});
