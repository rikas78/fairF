import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Metodo non consentito. Usa GET.' };
  }

  const params = event.queryStringParameters || {};
  const { subid, secret } = params;
  const FIXED_SECRET = 'FR5050_SECURE';

  if (secret !== FIXED_SECRET) {
    return { statusCode: 401, body: 'Non autorizzato: secret non valido.' };
  }

  if (!subid) {
    return { statusCode: 200, body: 'Errore: subid mancante.' };
  }

  try {
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', subid)
      .single();

    if (txError || !transaction) {
      return { statusCode: 200, body: 'Errore: Transazione non registrata.' };
    }

    if (transaction.status !== 'pending') {
      return { statusCode: 200, body: 'Transazione gia completata.' };
    }

    const userId = transaction.user_id;
    const rewardAmount = Number(transaction.net_reward || 0);

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('balance, pending_balance')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return { statusCode: 200, body: 'Errore: Utente associato non trovato.' };
    }

    const newPending = Math.max(0, Number(user.pending_balance || 0) - rewardAmount);
    const newBalance = Number(user.balance || 0) + rewardAmount;

    await supabase
      .from('transactions')
      .update({ status: 'completed' })
      .eq('id', subid);

    await supabase
      .from('users')
      .update({ 
        balance: newBalance,
        pending_balance: newPending
      })
      .eq('id', userId);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/plain' },
      body: 'OK'
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ status: 'error', message: error.message })
    };
  }
}