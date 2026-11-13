// Serves public runtime config from Vercel Environment Variables.
// Only the anon (public) key belongs here. NEVER add the service_role key.
module.exports = (req, res) => {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(200).send(
    "window.__ENV=" + JSON.stringify({
      SUPABASE_URL: process.env.SUPABASE_URL || "",
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || ""
    }) + ";"
  );
};
