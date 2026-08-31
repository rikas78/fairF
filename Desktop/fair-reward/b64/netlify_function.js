const fetch = require('node-fetch');

exports.handler = async (event) => {
  try {
    // CHIAVI HARDCODATE PER TEST VELOCE (Da cambiare in produzione)
    const SUPABASE_URL = "https://pzmppfkrrqdkxggmzzvs.supabase.co";
    const SUPABASE_SERVICE_KEY = "sb_publishable_FmBTZPJdk2x04cdz9jHEEg_JKkG314R"; 

    const body = event.body ? JSON.parse(event.body) : {};
    const idempotency = event.headers['idempotency-key'] || body.p_idempotency_key || require('crypto').randomUUID();

    const rpcBody = {
      p_user_id: body.user_id,
      p_task_id: body.task_id,
      p_request_cofinancing: body.request_cofinancing || false,
      p_idempotency_key: idempotency
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/participate_in_task`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify(rpcBody)
    });

    const json = await res.json();
    const status = json.status === 'success' ? 200 : (json.error_code === 'INSUFFICIENT_FUNDS' ? 402 : (json.error_code === 'FR_INSUFFICIENT_LIQUIDITY' ? 409 : 500));

    return { statusCode: status, body: JSON.stringify(json) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ status: 'error', error_code: 'INTERNAL_ERROR', message: err.message }) };
  }
};