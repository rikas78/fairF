/* eslint-disable no-undef */
/* global exports, process, console */
/**
 * cpaPostback (Base44-direct)
 * --------------------------------------------------------------------------
 * Riceve il postback di conversione CPAlead e accredita la "Quota Lavoratore"
 * (50/50) scrivendo DIRETTAMENTE nel database Base44 che legge il frontend.
 *
 * Sostituisce la vecchia versione Supabase: niente più database separato,
 * il saldo/stati dell'app si aggiornano realmente.
 *
 * Endpoint (da incollare nel pannello CPAlead -> Postback URL):
 *   https://fairreward.netlify.app/.netlify/functions/cpaPostback?subid={subid}&secret={secret}&payout={payout}
 *
 * Variabili d'ambiente (Netlify -> Site settings -> Environment variables):
 *   BASE44_APP_ID          = 6a7034195bfadc5004af71fd
 *   BASE44_ADMIN_EMAIL     = email di un utente admin dell'app
 *   BASE44_ADMIN_PASSWORD  = password dell'admin
 *   CPALEAD_SECRET         = FR5050_SECURE   (opzionale, valida il postback)
 *
 * Funziona con Node 18+ (fetch globale). Nessuna dipendenza npm esterna.
 */
const BASE44_URL = "https://base44.app";
const APP_ID = process.env.BASE44_APP_ID || "6a7034195bfadc5004af71fd";
const ADMIN_EMAIL = process.env.BASE44_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.BASE44_ADMIN_PASSWORD || "";
const SECRET = process.env.CPALEAD_SECRET || "FR5050_SECURE";

const HEADERS = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
const json = (code, body) => ({ statusCode: code, headers: HEADERS, body: JSON.stringify(body) });

async function b44(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE44_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* ignore */ }
  if (!res.ok) {
    const err = new Error(`Base44 ${res.status}: ${text}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

exports.handler = async (event) => {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    return json(500, { status: "error", message: "Credenziali admin Base44 mancanti (BASE44_ADMIN_EMAIL / BASE44_ADMIN_PASSWORD)." });
  }

  const params = event.queryStringParameters || {};
  if (SECRET && params.secret !== SECRET) return json(401, { status: "error", message: "Non autorizzato." });

  const subid = params.subid || params.s1 || "";
  if (!subid) return json(400, { status: "error", message: "Subid mancante." });

  const payout = Number(params.payout) || 0;
  if (payout <= 0) return json(400, { status: "error", message: "Payout non valido." });

  // 0) Login come admin Base44 (il token admin rispetta le RLS e puo' scrivere ovunque serve)
  let token;
  try {
    const login = await b44(`/api/auth/login`, {
      method: "POST",
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    token = login && login.access_token;
  } catch (err) {
    return json(401, { status: "error", message: "Login admin fallito.", details: String(err && err.message) });
  }
  if (!token) return json(401, { status: "error", message: "Token admin mancante." });

  // 1) Trova la transazione pending per reference_id = subid
  let txs;
  try {
    const q = JSON.stringify({ reference_id: subid, status: "pending" });
    txs = await b44(`/api/apps/${APP_ID}/entities/Transaction?q=${encodeURIComponent(q)}&limit=10`, { token });
  } catch (err) {
    return json(500, { status: "error", message: "Errore lettura transazioni.", details: String(err && err.message) });
  }
  if (!txs || !txs.length) {
    // Gia' processata o non trovata -> idempotente
    return json(200, { ok: true, message: "Already processed or not found" });
  }
  const tx = txs[0];
  const userId = tx.user_id;

  // 2) UserTask + Task per ricavare expense_percentage
  let userTask = null;
  try {
    userTask = await b44(`/api/apps/${APP_ID}/entities/UserTask/${subid}`, { token });
  } catch { userTask = null; }

  let expensePercentage = 25;
  let taskId = null;
  if (userTask) {
    taskId = userTask.task_id;
    try {
      const task = await b44(`/api/apps/${APP_ID}/entities/Task/${taskId}`, { token });
      if (task && typeof task.expense_percentage === "number") expensePercentage = task.expense_percentage;
    } catch { /* fallback 25% */ }
  }

  // 3) Calcolo 50/50 sul payout REALE del partner
  const costs = payout * (expensePercentage / 100);
  const net = payout - costs;
  const workerQuota = Math.round(net * 0.5 * 100) / 100;
  const frQuota = Math.round((net - workerQuota) * 100) / 100;

  // 4) Accredita saldo utente
  let user;
  try {
    user = await b44(`/api/apps/${APP_ID}/entities/User/${userId}`, { token });
  } catch (err) {
    return json(404, { status: "error", message: "Utente non trovato.", details: String(err && err.message) });
  }
  const newBalance = (Number(user && user.balance) || 0) + workerQuota;
  try {
    await b44(`/api/apps/${APP_ID}/entities/User/${userId}`, { method: "PUT", body: { balance: newBalance }, token });
  } catch (err) {
    return json(500, { status: "error", message: "Errore accredito saldo.", details: String(err && err.message) });
  }

  // 5) Transazione -> completed
  try {
    await b44(`/api/apps/${APP_ID}/entities/Transaction/${tx.id}`, {
      method: "PUT",
      body: { status: "completed", amount: workerQuota },
      token,
    });
  } catch (err) {
    return json(500, { status: "error", message: "Errore aggiornamento transazione.", details: String(err && err.message) });
  }

  // 6) UserTask -> completed
  if (userTask) {
    try {
      await b44(`/api/apps/${APP_ID}/entities/UserTask/${subid}`, {
        method: "PUT",
        body: {
          status: "completed",
          user_quota: workerQuota,
          fr_quota: frQuota,
          task_completed_at: new Date().toISOString(),
        },
        token,
      });
    } catch { /* non bloccante */ }
  }

  // 7) Audit log
  try {
    await b44(`/api/apps/${APP_ID}/entities/AuditLog`, {
      method: "POST",
      body: {
        actor: "cpa_postback",
        action: "partner_conversion",
        payload: {
          subid, user_id: userId, task_id: taskId, payout,
          expense_percentage: expensePercentage, costs, net,
          worker_quota: workerQuota, fr_quota: frQuota, new_balance: newBalance,
        },
      },
      token,
    });
  } catch { /* non bloccante */ }

  // 8) Riscontro email all'admin (prova dell'avvenuta conversione)
  try {
    await b44(`/api/apps/${APP_ID}/integration-endpoints/Core/SendEmail`, {
      method: "POST",
      body: {
        to: ADMIN_EMAIL,
        subject: "Conversione CPAlead ricevuta",
        body:
          "Conversione CPAlead ricevuta.\n\n" +
          "Subid: " + subid + "\n" +
          "Task: " + (taskId || subid) + "\n" +
          "Utente: " + ((user && user.email) || userId) + "\n" +
          "Lordo: EUR " + payout.toFixed(2) + "\n" +
          "Quota Lavoratore: EUR " + workerQuota.toFixed(2) + "\n" +
          "Quota FR: EUR " + frQuota.toFixed(2) + "\n" +
          "Nuovo saldo utente: EUR " + newBalance.toFixed(2),
      },
      token,
    });
  } catch { /* non bloccante */ }

  return json(200, {
    ok: true,
    subid,
    payout,
    worker_quota: workerQuota,
    fr_quota: frQuota,
    new_balance: newBalance,
  });
};