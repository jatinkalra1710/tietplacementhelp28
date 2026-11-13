(() => {
const E = window.__ENV || {};
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safe = u => /^https?:\/\//i.test(u) ? esc(u) : "#";
const fmt = d => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const ini = n => (n || "?").split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
const ago = d => { const s = (Date.now() - new Date(d)) / 1e3; return s < 60 ? "just now" : s < 3600 ? Math.floor(s / 60) + "m ago" : s < 86400 ? Math.floor(s / 3600) + "h ago" : fmt(d) };
const days = d => Math.ceil((new Date(d + "T23:59:59") - Date.now()) / 864e5);
function toast(m, t = "ok") { const el = document.createElement("div"); el.className = "toast " + t; el.textContent = m; $("#toasts").append(el); setTimeout(() => el.classList.add("out"), 3000); setTimeout(() => el.remove(), 3500) }
function modal(html) { const m = document.createElement("div"); m.className = "modal"; m.innerHTML = `<div class="mbox">${html}</div>`; m.onclick = e => { if (e.target === m) m.remove() }; document.body.append(m); return m }
const head = (t, s = "", a = "") => `<div class="ph"><div><h2>${t}</h2>${s ? `<p class="muted">${s}</p>` : ""}</div><div class="row">${a}</div></div>`;
const empty = (i, t) => `<div class="empty"><div>${i}</div><p>${t}</p></div>`;
const skel = n => '<div class="card sk"></div>'.repeat(n);

/* theme */
const themeBtn = $("#theme");
const paintTheme = () => themeBtn.textContent = document.documentElement.dataset.theme === "dark" ? "☀️" : "🌙";
themeBtn.onclick = () => { const n = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = n; localStorage.setItem("theme", n); paintTheme() };
paintTheme();

/* smooth anchor links */
document.addEventListener("click", e => {
  const a = e.target.closest("[data-s]"); if (!a) return;
  e.preventDefault(); if (/^#\/(dashboard|mentor)/.test(location.hash)) location.hash = "#/batch/" + curBatch;
  setTimeout(() => document.getElementById(a.dataset.s)?.scrollIntoView({ behavior: "smooth" }), 60);
});

if (!E.SUPABASE_URL || !E.SUPABASE_ANON_KEY) {
  document.body.innerHTML = '<div style="max-width:560px;margin:80px auto;padding:20px;font-family:system-ui"><h2>Setup needed</h2><p>Add <code>SUPABASE_URL</code> and <code>SUPABASE_ANON_KEY</code> in Vercel → Project → Settings → Environment Variables, then redeploy.</p></div>';
  return;
}
const sb = supabase.createClient(E.SUPABASE_URL, E.SUPABASE_ANON_KEY, { auth: { flowType: "pkce", detectSessionInUrl: true } });
let S = null, me = "", myName = "", isS = false, isA = false, myBatch = 0, timer = null, uid = null;

/* ---------- routing & auth ---------- */
async function route() {
  clearInterval(timer);
  const { data: { session } } = await sb.auth.getSession(); S = session;
  const h = location.hash, dash = h.startsWith("#/dashboard"), men = h.startsWith("#/mentor");
  $("#nOut").classList.toggle("hide", !S); $("#nDash").classList.toggle("hide", !S); $("#nIn").classList.toggle("hide", !!S);
  $("#v-home").classList.toggle("hide", dash || men); $("#v-mentor").classList.toggle("hide", !men); $("#v-dash").classList.toggle("hide", !dash);
  if (!dash && !men) setBatch(h.startsWith("#/batch/") ? +h.slice(8) : curBatch);
  if (men) window.scrollTo(0, 0);
  if (!dash) return;
  window.scrollTo(0, 0);
  if (!S) {
    $("#dash").innerHTML = `<div class="card ctr" style="max-width:440px;margin:60px auto;padding:36px"><div class="big2">🔐</div><h2>Sign in</h2><p class="muted" style="margin:6px 0 20px">Use the Google account you applied with.</p><button class="btn lg" id="gb">Continue with Google</button></div>`;
    $("#gb").onclick = googleIn;
    return;
  }
  dashboard();
}
window.addEventListener("hashchange", route);
sb.auth.onAuthStateChange((ev, s) => {
  if (ev === "SIGNED_IN" && sessionStorage.getItem("go")) { sessionStorage.removeItem("go"); location.hash = "#/dashboard" }
  const id = s?.user?.id || null; if (id !== uid) { uid = id; setTimeout(route, 0) }
});
$("#nOut").onclick = async () => { await sb.auth.signOut(); location.hash = "#/"; toast("Signed out") };

/* ---------- landing ---------- */
(async () => {
  const { data: mp } = await sb.from("senior_profiles").select("name,company,role,bio");
  if (mp?.length) { $("#mentors").classList.remove("hide"); $("#mentorList").innerHTML = mp.map(p => `<div class="card lift"><div class="mav">${esc(ini(p.name))}</div><h3>${esc(p.name)}</h3><p class="ac" style="font-weight:600">${esc([p.role, p.company].filter(Boolean).join(" · "))}</p><p style="margin-top:6px">${esc(p.bio || "")}</p></div>`).join("") }
})();
const BATCHES = [2028, 2029, 2030]; let curBatch = 2028;
const BOPT = '<option value="">All batches</option>' + BATCHES.map(b => `<option value="${b}">Batch ${b}</option>`).join("");
const BTXT = {
  2028: "Internship season starts now. Build a resume that clears screening, ace the online assessments and avoid the mistakes we made.",
  2029: "Start early and stay ahead. A clear DSA and projects roadmap, plus guidance on your first internships.",
  2030: "Welcome to Thapar! Build the right habits from day one with advice on DSA, projects, societies and what actually matters."
};
async function setBatch(b) {
  if (!BATCHES.includes(b)) b = curBatch; curBatch = b;
  $$(".bn").forEach(e => e.textContent = b); $("#fbatch").value = b; $("#bLead").textContent = BTXT[b];
  $("#cgLbl").textContent = b <= 2028 ? "CGPA *" : "CGPA (optional)";
  $("#bpick").innerHTML = "<span>Your batch:</span>" + BATCHES.map(x => `<a class="chip ${x === b ? "on" : ""}" href="#/batch/${x}">${x}</a>`).join("");
}
const googleIn = () => { sessionStorage.setItem("go", "1"); sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } }) };
$("#goIn").onclick = googleIn;
$("#fbatch").onchange = e => location.hash = "#/batch/" + e.target.value;
$("#resume").onchange = e => $("#fname").textContent = e.target.files[0]?.name || "Choose a PDF…";
$("#f").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target, d = new FormData(f), err = $("#err"), btn = $("#sub");
  const name = d.get("name").trim(), email = d.get("email").trim().toLowerCase(), phone = d.get("phone").trim(), cgpa = parseFloat(d.get("cgpa")), file = d.get("resume"), batch = +d.get("batch");
  err.textContent = "";
  if (!name) return err.textContent = "Please enter your name.";
  if (!/^\S+@\S+\.\S+$/.test(email)) return err.textContent = "Please enter a valid email.";
  if (!d.get("branch")) return err.textContent = "Please select your branch.";
  if ((batch <= 2028 || d.get("cgpa")) && (isNaN(cgpa) || cgpa < 0 || cgpa > 10)) return err.textContent = "Enter a CGPA between 0 and 10.";
  if (phone && !/^\d{10}$/.test(phone)) return err.textContent = "Contact number should be 10 digits.";
  if (!file || !file.size) return err.textContent = "Please attach your resume (PDF).";
  if (file.type !== "application/pdf") return err.textContent = "Resume must be a PDF.";
  if (file.size > 2 * 1024 * 1024) return err.textContent = "Resume must be under 2 MB.";
  btn.disabled = true; btn.textContent = "Submitting…";
  try {
    const path = crypto.randomUUID() + ".pdf";
    const up = await sb.storage.from("resumes").upload(path, file, { contentType: "application/pdf" });
    if (up.error) throw up.error;
    const ins = await sb.from("applications").insert({ name, email, batch, branch: d.get("branch"), cgpa: isNaN(cgpa) ? null : cgpa, phone: phone || null, goal: d.get("goal").trim() || null, resume_path: path });
    if (ins.error) throw ins.error;
    f.classList.add("hide"); $("#done").classList.remove("hide"); toast("Registration submitted 🎉");
  } catch (x) {
    err.textContent = x.code === "23505" ? "This email has already applied." : "Something went wrong. Please try again.";
    btn.disabled = false; btn.textContent = "Submit application";
  }
});

/* ---------- mentor registration ---------- */
$("#mresume").onchange = e => $("#mfname").textContent = e.target.files[0]?.name || "Choose a PDF…";
$("#mf").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target, d = new FormData(f), err = $("#merr"), btn = $("#msub"), v = k => (d.get(k) || "").trim();
  const email = v("email").toLowerCase(), phone = v("phone"), li = v("linkedin"), gh = v("github"), file = d.get("resume");
  err.textContent = "";
  if (!v("name")) return err.textContent = "Please enter your name.";
  if (!/^\S+@\S+\.\S+$/.test(email)) return err.textContent = "Please enter a valid email.";
  if (!v("company")) return err.textContent = "Please enter your company.";
  if (!/^\d{10}$/.test(phone)) return err.textContent = "Enter a 10-digit mobile number.";
  if (!/^https?:\/\/([\w-]+\.)?linkedin\.com\//i.test(li)) return err.textContent = "Enter a valid LinkedIn profile link.";
  if (gh && !/^https?:\/\/(www\.)?github\.com\//i.test(gh)) return err.textContent = "Enter a valid GitHub profile link.";
  if (!file || !file.size) return err.textContent = "Please attach your resume (PDF).";
  if (file.type !== "application/pdf") return err.textContent = "Resume must be a PDF.";
  if (file.size > 2 * 1024 * 1024) return err.textContent = "Resume must be under 2 MB.";
  btn.disabled = true; btn.textContent = "Submitting…";
  try {
    const path = "mentors/" + crypto.randomUUID() + ".pdf";
    const up = await sb.storage.from("resumes").upload(path, file, { contentType: "application/pdf" });
    if (up.error) throw up.error;
    const ins = await sb.from("mentor_applications").insert({ name: v("name"), email, grad_batch: v("grad_batch"), company: v("company"), phone, linkedin: li, github: gh || null, resume_path: path });
    if (ins.error) throw ins.error;
    f.classList.add("hide"); $("#mdone").classList.remove("hide"); toast("Mentor registration submitted 🙌");
  } catch (x) {
    err.textContent = x.code === "23505" ? "This email has already registered as a mentor." : "Something went wrong. Please try again.";
    btn.disabled = false; btn.textContent = "Submit mentor registration";
  }
});

/* ---------- dashboard shell ---------- */
const gate = (i, t, p) => $("#dash").innerHTML = `<div class="card ctr" style="max-width:500px;margin:60px auto;padding:36px"><div class="big2">${i}</div><h2>${t}</h2><p class="muted" style="margin-top:6px">${p}</p></div>`;
async function dashboard() {
  $("#dash").innerHTML = skel(4);
  me = S.user.email.toLowerCase(); myName = S.user.user_metadata?.full_name || me;
  const [{ data: sen }, { data: adm }] = await Promise.all([sb.rpc("is_senior"), sb.rpc("is_admin")]); isS = !!sen; isA = !!adm;
  if (!isS) {
    const [{ data: a }, { data: mp }] = await Promise.all([sb.from("applications").select("name,status,batch").eq("email", me).maybeSingle(), sb.from("mentor_applications").select("status").eq("email", me).maybeSingle()]);
    if (!a && mp) return gate(mp.status === "pending" ? "⏳" : "💙", mp.status === "pending" ? "Mentor registration under review" : "Mentor registration not approved", mp.status === "pending" ? "An admin will review your registration soon. You’ll get access here once approved." : "Thanks for applying to mentor. Contact the admins if you think this is a mistake.");
    if (!a) return gate("🤔", "No application found", `${esc(me)} hasn’t applied yet. <a class="ac" href="#/" data-s="apply">Register here</a>, or sign out and use the Google account you applied with.`);
    if (a.status === "pending") return gate("⏳", `Hi ${esc(a.name.split(" ")[0])}, you’re in the queue`, "Your application is under review. You’ll get access here as soon as you’re approved.");
    if (a.status === "rejected") return gate("🚫", "Access removed", "An admin removed your access. Contact the seniors if you think this is a mistake.");
    myName = a.name; myBatch = a.batch;
  }
  go(isS ? "apps" : "home");
}
const NAV = () => isS ? [["apps", "📋", "Students"], ...(isA ? [["men", "🎓", "Mentors"]] : []), ["ask", "💬", "Questions"], ["res", "📚", "Resources"], ["jobs", "💼", "Jobs"], ["ann", "📣", "Announcements"], ["prof", "👤", "My profile"]]
  : [["home", "🏠", "Overview"], ["res", "📚", "Resources"], ["jobs", "💼", "Jobs"], ["ask", "💬", "Ask a Senior"]];
const VIEWS = {};
function go(t) {
  clearInterval(timer);
  $("#dash").innerHTML = `<div class="dash"><aside class="side"><div class="me"><span class="av">${esc(ini(myName))}</span><div><b>${esc(myName)}</b><small>${isA ? "Admin" : isS ? "Mentor" : "Member · Batch " + myBatch}</small></div></div>${NAV().map(([k, i, l]) => `<button class="${k === t ? "on" : ""}" data-t="${k}">${i} ${l}</button>`).join("")}</aside><section class="main" id="tc"></section></div>`;
  $$("[data-t]").forEach(b => b.onclick = () => go(b.dataset.t));
  VIEWS[t]($("#tc"));
}
function wireAdd(c, table, build, reload) {
  const f = $("#af", c);
  if (f) f.onsubmit = async e => { e.preventDefault(); const b = $("button", f); b.disabled = true; const { error } = await sb.from(table).insert(build(f)); if (error) { b.disabled = false; return toast("Could not add. Links must start with https://", "bad") } toast("Added ✓"); reload() };
  $$("[data-del]", c).forEach(b => b.onclick = async e => { e.stopPropagation(); if (!confirm("Delete this?")) return; await sb.from(table).delete().eq("id", b.dataset.del); toast("Deleted"); reload() });
}

/* ---------- member overview ---------- */
VIEWS.home = async c => {
  c.innerHTML = head(`Hey ${esc(myName.split(" ")[0])} 👋`, "Here’s what’s new in your cohort.") + skel(3);
  const [an, js, qs] = await Promise.all([
    sb.from("announcements").select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(6),
    sb.from("job_status").select("state").eq("user_email", me), sb.from("questions").select("id").eq("junior_email", me)]);
  const n = k => (js.data || []).filter(x => x.state === k).length;
  c.innerHTML = head(`Hey ${esc(myName.split(" ")[0])} 👋`, "Here’s what’s new in your cohort.") +
    `<div class="stats"><div class="card"><b>${n("saved")}</b><small>Jobs saved</small></div><div class="card"><b>${n("applied")}</b><small>Jobs applied</small></div><div class="card"><b>${(qs.data || []).length}</b><small>Your questions</small></div></div>
    <h3 style="margin:18px 0 10px">📣 Announcements</h3>` +
    ((an.data || []).map(a => `<div class="card ann item"><div><h3>${a.pinned ? "📌 " : ""}${esc(a.title)}</h3><p>${esc(a.body || "")}</p><small class="muted">${ago(a.created_at)}</small></div></div>`).join("") || empty("📭", "No announcements yet."));
};

/* ---------- resources ---------- */
VIEWS.res = async c => {
  c.innerHTML = head("Resources", "Curated by your seniors") + skel(3);
  const { data, error } = await sb.from("resources").select("*").order("created_at", { ascending: false });
  if (error) return c.innerHTML = empty("⚠️", "Could not load resources.");
  const cats = ["All", ...new Set(data.map(r => r.category))]; let cat = "All", q = "";
  c.innerHTML = head("Resources", "Curated by your seniors") + (isS ? `<form id="af" class="card" style="margin-bottom:16px"><h3>Add a resource</h3><div class="two"><label>Title<input name="title" required></label><label>Link<input name="url" type="url" required placeholder="https://"></label></div>
    <div class="two"><label>Category<select name="category"><option>DSA</option><option>Core</option><option>Development</option><option>Resume</option><option>Interview</option><option>Aptitude</option><option>Other</option></select></label><label>Note (optional)<input name="description"></label></div><label>Visible to<select name="batch">${BOPT}</select></label><div><button class="btn">Add resource</button></div></form>` : "") +
    `<div class="bar"><div class="chips" id="chips"></div><input id="q" class="srch" placeholder="Search resources…"></div><div id="lst"></div>`;
  const paint = () => {
    $("#chips").innerHTML = cats.map(k => `<button class="chip ${k === cat ? "on" : ""}" data-c="${esc(k)}">${esc(k)}</button>`).join("");
    const l = data.filter(r => (cat === "All" || r.category === cat) && (!q || (r.title + (r.description || "")).toLowerCase().includes(q)));
    $("#lst").innerHTML = l.map(r => `<div class="card item"><div><h3><a class="ac" href="${safe(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.title)} ↗</a></h3><span class="pill">${esc(r.category)}</span>${r.batch ? `<span class="pill">Batch ${r.batch}</span>` : ""}<span class="muted">${esc(r.description || "")}</span></div>${isS ? `<button class="btn sm no" data-del="${esc(r.id)}">Delete</button>` : ""}</div>`).join("") || empty("📚", "Nothing here yet.");
    $$("[data-c]", c).forEach(b => b.onclick = () => { cat = b.dataset.c; paint() }); wireAdd(c, "resources", () => ({}), () => VIEWS.res(c));
  };
  $("#q").oninput = e => { q = e.target.value.trim().toLowerCase(); paint() };
  paint();
  const f = $("#af", c); if (f) f.onsubmit = async e => { e.preventDefault(); const { error } = await sb.from("resources").insert({ title: f.title.value.trim(), url: f.url.value.trim(), category: f.category.value, description: f.description.value.trim() || null, batch: f.batch.value ? +f.batch.value : null, created_by: me }); if (error) return toast("Link must start with https://", "bad"); toast("Resource added ✓"); VIEWS.res(c) };
};

/* ---------- jobs ---------- */
VIEWS.jobs = async c => {
  c.innerHTML = head("Jobs & internships", "Fresh openings, shared early") + skel(3);
  const [{ data: jobs, error }, { data: st }] = await Promise.all([sb.from("jobs").select("*").order("created_at", { ascending: false }), isS ? { data: [] } : sb.from("job_status").select("job_id,state").eq("user_email", me)]);
  if (error) return c.innerHTML = empty("⚠️", "Could not load jobs.");
  const stm = Object.fromEntries((st || []).map(s => [s.job_id, s.state])); let f = "All", q = "";
  const filters = isS ? ["All", "Internship", "Full-time", "Off-campus"] : ["All", "Internship", "Full-time", "Off-campus", "Saved", "Applied"];
  c.innerHTML = head("Jobs & internships", "Fresh openings, shared early") + (isS ? `<form id="af" class="card" style="margin-bottom:16px"><h3>Post a job / internship</h3><div class="two"><label>Company<input name="company" required></label><label>Role<input name="role" required></label></div>
    <div class="two"><label>Apply link<input name="link" type="url" required placeholder="https://"></label><label>Type<select name="type"><option>Internship</option><option>Full-time</option><option>Off-campus</option></select></label></div>
    <div class="two"><label>Eligible branches<input name="branches" placeholder="All / COE, ECE…"></label><label>Deadline<input name="deadline" type="date"></label></div>
    <label>Visible to<select name="batch">${BOPT}</select></label><div class="row sb"><label class="row" style="display:flex"><input type="checkbox" name="referral"> Referral available</label><button class="btn">Post job</button></div></form>` : "") +
    `<div class="bar"><div class="chips" id="chips"></div><input id="q" class="srch" placeholder="Search company or role…"></div><div id="lst"></div>`;
  const paint = () => {
    $("#chips").innerHTML = filters.map(k => `<button class="chip ${k === f ? "on" : ""}" data-c="${k}">${k}</button>`).join("");
    const l = jobs.filter(j => (f === "All" || j.type === f || stm[j.id] === f.toLowerCase()) && (!q || (j.company + j.role).toLowerCase().includes(q)));
    $("#lst").innerHTML = l.map(j => {
      const d = j.deadline ? days(j.deadline) : null, s = stm[j.id];
      return `<div class="card item"><div><h3><a class="ac" href="${safe(j.link)}" target="_blank" rel="noopener noreferrer">${esc(j.role)} · ${esc(j.company)} ↗</a></h3>
      <span class="pill">${esc(j.type)}</span>${j.batch ? `<span class="pill">Batch ${j.batch}</span>` : ""}${j.referral ? '<span class="pill good">🤝 Referral</span>' : ""}${d !== null ? (d < 0 ? '<span class="pill bad">Closed</span>' : d <= 3 ? `<span class="pill warn">⏰ ${d}d left</span>` : `<span class="pill">Due ${fmt(j.deadline)}</span>`) : ""}
      <span class="muted">${j.branches ? esc(j.branches) : ""}</span></div>
      ${isS ? `<button class="btn sm no" data-del="${esc(j.id)}">Delete</button>` : `<div class="row" style="flex:none"><button class="btn sm ${s === "saved" ? "" : "g"}" data-st="saved" data-id="${esc(j.id)}">${s === "saved" ? "★ Saved" : "☆ Save"}</button><button class="btn sm ${s === "applied" ? "ok" : "g"}" data-st="applied" data-id="${esc(j.id)}">${s === "applied" ? "✓ Applied" : "Mark applied"}</button></div>`}</div>`;
    }).join("") || empty("💼", "No openings match.");
    $$("[data-c]", c).forEach(b => b.onclick = () => { f = b.dataset.c; paint() });
    $$("[data-st]", c).forEach(b => b.onclick = async () => {
      const id = b.dataset.id, ns = b.dataset.st, same = stm[id] === ns;
      const r = same ? await sb.from("job_status").delete().eq("user_email", me).eq("job_id", id) : await sb.from("job_status").upsert({ user_email: me, job_id: id, state: ns, updated_at: new Date().toISOString() }, { onConflict: "user_email,job_id" });
      if (r.error) return toast("Could not update", "bad"); same ? delete stm[id] : stm[id] = ns; paint();
    });
    $$("[data-del]", c).forEach(b => b.onclick = async () => { if (!confirm("Delete this job?")) return; await sb.from("jobs").delete().eq("id", b.dataset.del); toast("Deleted"); VIEWS.jobs(c) });
  };
  $("#q").oninput = e => { q = e.target.value.trim().toLowerCase(); paint() };
  paint();
  const fm = $("#af", c); if (fm) fm.onsubmit = async e => { e.preventDefault(); const { error } = await sb.from("jobs").insert({ company: fm.company.value.trim(), role: fm.role.value.trim(), link: fm.link.value.trim(), type: fm.type.value, branches: fm.branches.value.trim() || null, deadline: fm.deadline.value || null, referral: fm.referral.checked, batch: fm.batch.value ? +fm.batch.value : null, created_by: me }); if (error) return toast("Link must start with https://", "bad"); toast("Job posted ✓"); VIEWS.jobs(c) };
};

/* ---------- Ask a Senior (private) ---------- */
VIEWS.ask = async c => {
  c.innerHTML = head(isS ? "Questions" : "Ask a Senior", "Private. Only the student and one senior can see each chat.") + skel(2);
  const { data, error } = await sb.from("questions").select("*").order("created_at", { ascending: false });
  if (error) return c.innerHTML = empty("⚠️", "Could not load questions.");
  const row = q => `<div class="card item click" data-q="${esc(q.id)}"><div><h3>${esc(q.title)}</h3><span class="muted">${isS ? esc(q.junior_name) + " · " : ""}${ago(q.created_at)}</span></div><span class="pill ${q.assigned_to ? "good" : "warn"}">${q.assigned_to ? "With " + esc(q.assigned_name || "a senior") : "Waiting"}</span></div>`;
  const H = head(isS ? "Questions" : "Ask a Senior", "Private. Only the student and one senior can see each chat.");
  if (isS) {
    const free = data.filter(q => !q.assigned_to), mine = data.filter(q => q.assigned_to);
    c.innerHTML = H + `<h3 style="margin-bottom:10px">Unclaimed (${free.length})</h3>${free.map(row).join("") || empty("🎉", "Nothing waiting.")}<h3 style="margin:20px 0 10px">My conversations (${mine.length})</h3>${mine.map(row).join("") || empty("💬", "Open an unclaimed question to take it.")}`;
  } else {
    c.innerHTML = H + `<form id="qf" class="card" style="margin-bottom:16px"><h3>New question</h3><label>Title<input name="title" required maxlength="120" placeholder="e.g. How should I start DSA in 3rd sem?"></label><label>Details<textarea name="body" rows="3" required maxlength="4000"></textarea></label><div><button class="btn">Send privately</button></div></form>${data.map(row).join("") || empty("💬", "You haven’t asked anything yet.")}`;
    $("#qf").onsubmit = async e => {
      e.preventDefault(); const f = e.target, b = $("button", f); b.disabled = true;
      const { data: q, error } = await sb.from("questions").insert({ junior_email: me, junior_name: myName, title: f.title.value.trim() }).select().single();
      if (error) { b.disabled = false; return toast("Could not send", "bad") }
      const m = await sb.from("messages").insert({ question_id: q.id, sender_email: me, sender_name: myName, sender_role: "junior", body: f.body.value.trim() });
      toast(m.error ? "Question created, but message failed" : "Sent. A senior will pick it up", m.error ? "bad" : "ok"); VIEWS.ask(c);
    };
  }
  $$("[data-q]", c).forEach(el => el.onclick = () => thread(el.dataset.q, c));
};
async function thread(id, c) {
  const { data: q } = await sb.from("questions").select("*").eq("id", id).single();
  if (!q) return VIEWS.ask(c);
  const bub = ms => ms.map(m => `<div class="m ${m.sender_email === me ? "me" : ""}"><small>${esc(m.sender_role === "senior" ? "Senior · " + m.sender_name : m.sender_name)} · ${ago(m.created_at)}</small>${esc(m.body)}</div>`).join("");
  const load = async () => (await sb.from("messages").select("*").eq("question_id", id).order("created_at")).data || [];
  let ms = await load();
  const can = q.junior_email === me || q.assigned_to === me;
  c.innerHTML = `<button class="btn sm g" id="bk">← Back</button><div class="card" style="margin-top:14px"><h3>${esc(q.title)}</h3><span class="muted">🔒 Private · ${esc(q.junior_name)}${q.assigned_name ? " with " + esc(q.assigned_name) : ""}</span><div class="msgs" id="ms">${bub(ms)}</div>
    ${isS && !q.assigned_to ? '<button class="btn ok" id="cl">Claim this question</button>' : can ? '<form id="rf"><textarea name="b" rows="2" required maxlength="4000" placeholder="Write a reply…"></textarea><div><button class="btn">Send</button></div></form>' : ""}</div>`;
  const box = $("#ms"); box.scrollTop = box.scrollHeight; $("#bk").onclick = () => VIEWS.ask(c);
  if ($("#cl")) $("#cl").onclick = async () => { const { error } = await sb.from("questions").update({ assigned_to: me, assigned_name: myName }).eq("id", id).is("assigned_to", null); if (error) return toast("Someone else just claimed it", "bad"); toast("Claimed ✓"); thread(id, c) };
  if ($("#rf")) {
    $("#rf").onsubmit = async e => { e.preventDefault(); const f = e.target, body = f.b.value.trim(); if (!body) return; const { error } = await sb.from("messages").insert({ question_id: id, sender_email: me, sender_name: myName, sender_role: isS ? "senior" : "junior", body }); if (error) return toast("Could not send", "bad"); f.b.value = ""; ms = await load(); box.innerHTML = bub(ms); box.scrollTop = box.scrollHeight };
    timer = setInterval(async () => { const n = await load(); if (n.length !== ms.length) { ms = n; box.innerHTML = bub(ms); box.scrollTop = box.scrollHeight } }, 6000);
  }
}

/* ---------- senior: applications ---------- */
VIEWS.apps = async c => {
  c.innerHTML = head("Students", "Everyone who registered. Revoke access if needed") + skel(4);
  const { data: rows, error } = await sb.from("applications").select("*").order("created_at", { ascending: false });
  if (error) return c.innerHTML = empty("⚠️", "Could not load applications.");
  let filter = "all", q = "", sort = "new", bf = 0;
  const base = () => bf ? rows.filter(r => r.batch === bf) : rows; const n = s => base().filter(r => r.status === s).length;
  const csv = l => { const cell = v => { v = String(v ?? ""); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"' }; return [["Name", "Email", "Batch", "Branch", "CGPA", "Phone", "Status", "Applied"], ...l.map(r => [r.name, r.email, r.batch, r.branch, r.cgpa, r.phone, r.status, r.created_at])].map(r => r.map(cell).join(",")).join("\n") };
  const setStatus = async (id, status) => { const { error } = await sb.from("applications").update({ status, reviewed_by: me }).eq("id", id); if (error) { toast("Update failed", "bad"); return false } const r = rows.find(x => x.id === id); r.status = status; toast(status === "approved" ? "Approved ✓ They can now sign in" : "Rejected"); return true };
  const branches = {}; rows.forEach(r => branches[r.branch] = (branches[r.branch] || 0) + 1); const mx = Math.max(1, ...Object.values(branches));
  c.innerHTML = head("Students", "Everyone who registered. Revoke access if needed", '<button class="btn g sm" id="ex">⬇ Export CSV</button>') +
    `<div id="sts"></div><div class="card" style="margin-bottom:16px"><h3 style="margin-bottom:10px">Applicants by branch</h3><div class="bars">${Object.entries(branches).sort((a, b) => b[1] - a[1]).map(([b, v]) => `<div class="br"><span>${esc(b)}</span><i style="width:${v / mx * 100}%"></i><span>${v}</span></div>`).join("")}</div></div>
    <div class="bar"><div class="chips" id="chips"></div><input id="q" class="srch" placeholder="Search name, email, branch…"><select id="so"><option value="new">Newest</option><option value="cg">CGPA high → low</option></select><select id="bs"><option value="0">All batches</option>${BATCHES.map(b => `<option value="${b}">Batch ${b}</option>`).join("")}</select></div><div id="lst" class="card tw"></div>`;
  const list = () => base().filter(r => (filter === "all" || r.status === filter) && (!q || (r.name + r.email + r.branch).toLowerCase().includes(q))).sort((a, b) => sort === "cg" ? (b.cgpa || 0) - (a.cgpa || 0) : 0);
  const paint = () => {
    $("#sts").innerHTML = `<div class="stats"><div class="card"><b>${base().length}</b><small>Total</small></div><div class="card"><b>${n("pending")}</b><small>Pending</small></div><div class="card"><b>${n("approved")}</b><small>Approved</small></div><div class="card"><b>${n("rejected")}</b><small>Rejected</small></div></div>`;
    $("#chips").innerHTML = ["pending", "approved", "rejected", "all"].map(s => `<button class="chip ${s === filter ? "on" : ""}" data-f="${s}">${s[0].toUpperCase() + s.slice(1)}</button>`).join("");
    const l = list();
    $("#lst").innerHTML = l.length ? `<table><thead><tr><th>Name</th><th>Batch</th><th>Branch</th><th>CGPA</th><th>Email</th><th>Applied</th><th>Status</th><th></th></tr></thead><tbody>${l.map(r => `<tr data-id="${esc(r.id)}"><td><b>${esc(r.name)}</b></td><td>${esc(r.batch)}</td><td>${esc(r.branch)}</td><td>${esc(r.cgpa)}</td><td>${esc(r.email)}</td><td>${fmt(r.created_at)}</td><td><span class="st2 ${esc(r.status)}">${esc(r.status)}</span></td><td>${r.status !== "approved" ? `<button class="btn sm ok" data-a="approved">${r.status === "rejected" ? "Restore" : "Approve"}</button>` : `<button class="btn sm no" data-a="rejected">Revoke</button>`}</td></tr>`).join("")}</tbody></table>` : empty("📭", "No applications here.");
    $$("[data-f]", c).forEach(b => b.onclick = () => { filter = b.dataset.f; paint() });
    $$("tbody tr", c).forEach(tr => tr.onclick = async e => {
      const id = tr.dataset.id, r = rows.find(x => x.id === id), qa = e.target.closest("[data-a]");
      if (qa) { if (await setStatus(id, qa.dataset.a)) paint(); return }
      const m = modal(`<div class="row sb"><h3 style="font-size:20px">${esc(r.name)}</h3><span class="st2 ${esc(r.status)}">${esc(r.status)}</span></div><div class="kv"><span>Email</span><span>${esc(r.email)}</span><span>Batch</span><span>${esc(r.batch)}</span><span>Branch</span><span>${esc(r.branch)}</span><span>CGPA</span><span>${esc(r.cgpa)}</span><span>Phone</span><span>${esc(r.phone || "-")}</span><span>Applied</span><span>${fmt(r.created_at)}</span><span>Goal</span><span>${esc(r.goal || "-")}</span>${r.reviewed_by ? `<span>Reviewed by</span><span>${esc(r.reviewed_by)}</span>` : ""}</div>
        <div class="row"><button class="btn g" id="vr">📄 View resume</button>${r.status !== "approved" ? '<button class="btn ok" data-m="approved">Approve</button>' : ""}${r.status !== "rejected" ? '<button class="btn no" data-m="rejected">Reject</button>' : ""}</div>`);
      $("#vr", m).onclick = async () => { const w = window.open("", "_blank"); const { data, error } = await sb.storage.from("resumes").createSignedUrl(r.resume_path, 120); if (error || !data) { w && w.close(); return toast("Could not open resume", "bad") } w.location = data.signedUrl };
      $$("[data-m]", m).forEach(b => b.onclick = async () => { if (await setStatus(id, b.dataset.m)) { m.remove(); paint() } });
    });
  };
  $("#q").oninput = e => { q = e.target.value.trim().toLowerCase(); paint() };
  $("#so").onchange = e => { sort = e.target.value; paint() };
  $("#bs").onchange = e => { bf = +e.target.value; paint() };
  $("#ex").onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv(list())], { type: "text/csv" })); a.download = `applications-${filter}.csv`; a.click(); toast("Exported") };
  paint();
};

/* ---------- senior: announcements ---------- */
VIEWS.ann = async c => {
  c.innerHTML = head("Announcements", "Shown on every member’s overview") + skel(2);
  const { data } = await sb.from("announcements").select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false });
  c.innerHTML = head("Announcements", "Shown on every member’s overview") + `<form id="af" class="card" style="margin-bottom:16px"><label>Title<input name="title" required maxlength="120"></label><label>Message<textarea name="body" rows="3"></textarea></label><label>Visible to<select name="batch">${BOPT}</select></label><div class="row sb"><label class="row" style="display:flex"><input type="checkbox" name="pinned"> 📌 Pin to top</label><button class="btn">Post announcement</button></div></form>` +
    ((data || []).map(a => `<div class="card ann item"><div><h3>${a.pinned ? "📌 " : ""}${esc(a.title)}</h3><p>${esc(a.body || "")}</p><small class="muted">${ago(a.created_at)} · ${esc(a.created_by || "")}</small></div><button class="btn sm no" data-del="${esc(a.id)}">Delete</button></div>`).join("") || empty("📣", "No announcements yet."));
  wireAdd(c, "announcements", f => ({ title: f.title.value.trim(), body: f.body.value.trim() || null, pinned: f.pinned.checked, batch: f.batch.value ? +f.batch.value : null, created_by: myName }), () => VIEWS.ann(c));
};

/* ---------- senior: profile ---------- */
VIEWS.prof = async c => {
  const { data: p } = await sb.from("senior_profiles").select("*").eq("owner_email", me).maybeSingle();
  c.innerHTML = head("My public profile", "Shown in “Meet your seniors” on the landing page") + `<form id="pf" class="card"><div class="two"><label>Name<input name="name" required value="${esc(p?.name || myName)}"></label><label>Company<input name="company" value="${esc(p?.company || "")}" placeholder="e.g. Amazon"></label></div>
    <label>Role<input name="role" value="${esc(p?.role || "")}" placeholder="e.g. SDE Intern"></label><label>Short bio<textarea name="bio" rows="3" maxlength="240" placeholder="One line juniors will remember">${esc(p?.bio || "")}</textarea></label><div class="row"><button class="btn">Save profile</button>${p ? '<button type="button" class="btn g" id="rm">Remove from site</button>' : ""}</div></form>`;
  $("#pf").onsubmit = async e => {
    e.preventDefault(); const f = e.target, v = { name: f.name.value.trim(), company: f.company.value.trim() || null, role: f.role.value.trim() || null, bio: f.bio.value.trim() || null };
    const { error } = p ? await sb.from("senior_profiles").update(v).eq("id", p.id) : await sb.from("senior_profiles").insert({ ...v, owner_email: me });
    toast(error ? "Could not save" : "Profile saved ✓", error ? "bad" : "ok"); if (!error) VIEWS.prof(c);
  };
  if ($("#rm")) $("#rm").onclick = async () => { await sb.from("senior_profiles").delete().eq("id", p.id); toast("Removed"); VIEWS.prof(c) };
};

/* ---------- admin: mentor applications ---------- */
VIEWS.men = async c => {
  const H = head("Mentor applications", "Approve seniors and alumni who want to guide juniors");
  c.innerHTML = H + skel(3);
  const { data: rows, error } = await sb.from("mentor_applications").select("*").order("created_at", { ascending: false });
  if (error) return c.innerHTML = empty("⚠️", "Could not load mentor applications.");
  let f = "pending"; const n = s => rows.filter(r => r.status === s).length;
  c.innerHTML = H + `<div class="stats"><div class="card"><b>${rows.length}</b><small>Total</small></div><div class="card"><b>${n("pending")}</b><small>Pending</small></div><div class="card"><b>${n("approved")}</b><small>Approved mentors</small></div></div><div class="chips" id="chips" style="margin-bottom:14px"></div><div id="lst"></div>`;
  const paint = () => {
    $("#chips").innerHTML = ["pending", "approved", "rejected", "all"].map(s => `<button class="chip ${s === f ? "on" : ""}" data-f="${s}">${s[0].toUpperCase() + s.slice(1)}</button>`).join("");
    const l = rows.filter(r => f === "all" || r.status === f);
    $("#lst").innerHTML = l.map(r => `<div class="card item"><div><h3>${esc(r.name)} <span class="st2 ${esc(r.status)}">${esc(r.status)}</span></h3>
      <p>${esc(r.company)} · Batch ${esc(r.grad_batch)}</p><p>${esc(r.email)} · ${esc(r.phone)}</p>
      <div class="row" style="margin-top:8px"><button class="btn sm g" data-r="${esc(r.resume_path)}">📄 Resume</button><a class="btn sm g" href="${safe(r.linkedin)}" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>${r.github ? `<a class="btn sm g" href="${safe(r.github)}" target="_blank" rel="noopener noreferrer">GitHub ↗</a>` : ""}</div></div>
      <div class="row" style="flex:none">${r.status !== "approved" ? `<button class="btn sm ok" data-m="approved" data-id="${esc(r.id)}">Approve</button>` : ""}${r.status === "pending" ? `<button class="btn sm no" data-m="rejected" data-id="${esc(r.id)}">Reject</button>` : ""}${r.status === "approved" ? `<button class="btn sm no" data-m="rejected" data-id="${esc(r.id)}">Revoke</button>` : ""}</div></div>`).join("") || empty("🎓", "No mentor applications here.");
    $$("[data-f]", c).forEach(b => b.onclick = () => { f = b.dataset.f; paint() });
    $$("[data-r]", c).forEach(b => b.onclick = async () => { const w = window.open("", "_blank"); const { data, error } = await sb.storage.from("resumes").createSignedUrl(b.dataset.r, 120); if (error || !data) { w && w.close(); return toast("Could not open resume", "bad") } w.location = data.signedUrl });
    $$("[data-m]", c).forEach(b => b.onclick = async () => {
      b.disabled = true; const { error } = await sb.rpc("set_mentor_status", { app_id: b.dataset.id, new_status: b.dataset.m });
      if (error) { b.disabled = false; return toast("Failed. Run migration_v2.sql and make sure you’re an admin.", "bad") }
      rows.find(r => r.id === b.dataset.id).status = b.dataset.m; toast(b.dataset.m === "approved" ? "Approved ✓ They now have mentor access" : "Updated"); VIEWS.men(c);
    });
  };
  paint();
};

route();
})();
