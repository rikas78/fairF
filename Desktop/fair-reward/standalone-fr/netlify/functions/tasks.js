/* eslint-disable no-undef */
/* global require, module, process, console */
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

const json = (code, body) => ({ statusCode: code, headers: HEADERS, body: JSON.stringify(body) });

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: HEADERS, body: "" };
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { status: "error", message: "Configurazione server mancante." });

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data, error } = await sb.from("tasks").select("*").order("sort_order", { ascending: true });
  if (error) return json(500, { status: "error", message: "Errore lettura task." });

  const tasks = data.map((t) => ({
    id: t.id,
    title: t.title,
    partner_url: t.partner_url,
    partner_type: t.partner_type,
    quota_total: Number(t.quota_total),
    net_reward: Number(t.net_reward),
    highlight: t.highlight,
  }));
  return json(200, { status: "success", tasks });
};