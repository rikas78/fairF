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

const json = (code, body) => ({
  statusCode: code,
  headers: HEADERS,
  body: JSON.stringify(body),
});

const BONUS_WELCOME = 2.0;

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: HEADERS, body: "" };
  if (event.httpMethod !== "POST") return json(405, { status: "error", message: "Metodo non consentito." });
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { status: "error", message: "Configurazione server mancante. Contatta l'assistenza." });

  let email = "";
  try {
    email = (JSON.parse(event.body || "{}").email || "").trim().toLowerCase();
  } catch {
    return json(400, { status: "error", message: "Richiesta non valida." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(400, { status: "error", message: "Inserisci un indirizzo email valido." });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    const { data: existing, error: selErr } = await sb
      .from("users")
      .select("id, email, nickname, balance")
      .eq("email", email)
      .maybeSingle();

    if (selErr) return json(500, { status: "error", message: "Errore di lettura account. Riprova." });

    let user = existing;
    if (!user) {
      const nickname = email.split("@")[0];
      const { data, error } = await sb
        .from("users")
        .insert({ email, nickname, balance: BONUS_WELCOME })
        .select("id, email, nickname, balance")
        .single();
      if (error) return json(500, { status: "error", message: "Impossibile creare l'account. Riprova tra poco." });
      user = data;
    }

    return json(200, {
      status: "success",
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        balance: Number(user.balance),
      },
    });
  } catch (err) {
    console.error("auth error", err);
    return json(500, { status: "error", message: "Errore imprevisto del server. Riprova." });
  }
};