/* eslint-disable no-undef */
/* global require, module, process, console */
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Idempotency-Key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (code, body) => ({ statusCode: code, headers: HEADERS, body: JSON.stringify(body) });

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: HEADERS, body: "" };
  if (event.httpMethod !== "POST") return json(405, { status: "error", message: "Metodo non consentito." });
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { status: "error", message: "Configurazione server mancante." });

  let payload = {};
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { status: "error", message: "Richiesta non valida." });
  }
  const userId = payload.user_id;
  const taskId = payload.task_id;
  const idempotencyKey = event.headers["idempotency-key"] || payload.idempotency_key;
  if (!userId || !taskId || !idempotencyKey)
    return json(400, { status: "error", message: "Parametri mancanti (user_id, task_id, Idempotency-Key)." });

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Idempotency: se la chiave esiste già, restituisce la transazione già avviata
  const { data: existing } = await sb
    .from("transactions")
    .select("id, task_id")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing) {
    const { data: t } = await sb.from("tasks").select("partner_url").eq("id", existing.task_id).maybeSingle();
    return json(200, { status: "success", transaction_id: existing.id, redirect_url: (t || {}).partner_url, already_started: true });
  }

  const { data: user } = await sb.from("users").select("balance").eq("id", userId).maybeSingle();
  if (!user) return json(404, { status: "error", message: "Utente non trovato." });
  const { data: task } = await sb.from("tasks").select("*").eq("id", taskId).maybeSingle();
  if (!task) return json(404, { status: "error", message: "Task non disponibile." });

  const stake = Number(task.quota_total) / 2;
  if (Number(user.balance) < stake)
    return json(402, { status: "error", message: "Saldo insufficiente per attivare questo lavoro." });

  const subid = `${userId.slice(0, 8)}-${idempotencyKey}`;

  const { data: tx, error: txErr } = await sb
    .from("transactions")
    .insert({
      user_id: userId,
      task_id: taskId,
      idempotency_key: idempotencyKey,
      subid,
      stake,
      net_reward: Number(task.net_reward),
      status: "pending",
    })
    .select("id")
    .single();

  if (txErr) {
    // Race: chiave unica già presente -> restituisce l'esistente
    if (txErr.code === "23505") {
      const { data: r } = await sb.from("transactions").select("id").eq("idempotency_key", idempotencyKey).maybeSingle();
      return json(200, { status: "success", transaction_id: r.id, redirect_url: task.partner_url, already_started: true });
    }
    return json(500, { status: "error", message: "Errore nella registrazione. Riprova." });
  }

  // Riserva la quota utente (50%)
  const { error: balErr } = await sb
    .from("users")
    .update({ balance: Number(user.balance) - stake })
    .eq("id", userId);
  if (balErr) return json(500, { status: "error", message: "Errore aggiornamento saldo." });

  const sep = task.partner_url.includes("?") ? "&" : "?";
  const redirectUrl = `${task.partner_url}${sep}subid=${encodeURIComponent(subid)}&subid2=${encodeURIComponent(taskId)}`;

  return json(200, { status: "success", transaction_id: tx.id, subid, redirect_url: redirectUrl });
};