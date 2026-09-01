import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Metodo non consentito' };
  }

  try {
    const { user_id, task_id } = JSON.parse(event.body);
    const idempotencyKey = event.headers['idempotency-key'] || event.headers['Idempotency-Key'];

    if (!user_id || !task_id) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ status: 'error', message: 'Parametri user_id o task_id mancanti' }) 
      };
    }

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', task_id)
      .single();

    if (taskError || !task) throw new Error('Task non trovato nel database.');

    const rawReward = Number(task.total_reward || 0);
    const expensePercentage = Number(task.expense_percentage || 25);
    const expenses = rawReward * (expensePercentage / 100);
    const netEarnings = rawReward - expenses;
    const userShare = Number((netEarnings * 0.5).toFixed(2));

    if (idempotencyKey) {
      const { data: existingTx } = await supabase
        .from('transactions')
        .select('*')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (existingTx) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({
            status: 'success',
            transaction_id: existingTx.id,
            redirect_url: `${task.partner_url}&subid=${existingTx.id}`
          })
        };
      }
    }

    const entryCost = Number(task.entry_cost || 0);
    if (entryCost > 0) {
      const advanceAmount = entryCost * 0.50;

      const { data: user } = await supabase
        .from('users')
        .select('balance')
        .eq('id', user_id)
        .single();

      if (user) {
        const newBalance = Number(user.balance) + advanceAmount;
        
        await supabase
          .from('users')
          .update({ balance: newBalance })
          .eq('id', user_id);

        await supabase
          .from('system_logs')
          .insert([{
            event_type: 'cofinance_advance',
            user_id: user_id,
            details: { task_id, entry_cost: entryCost, advance_credited: advanceAmount }
          }]);
      }
    }

    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert([{
        user_id,
        task_id,
        net_reward: userShare,
        status: 'pending',
        idempotency_key: idempotencyKey || null
      }])
      .select('*')
      .single();

    if (txError) throw txError;

    const { data: userToUpdate } = await supabase
      .from('users')
      .select('pending_balance')
      .eq('id', user_id)
      .single();

    if (userToUpdate) {
      const newPendingBalance = Number(userToUpdate.pending_balance || 0) + userShare;
      await supabase
        .from('users')
        .update({ pending_balance: newPendingBalance })
        .eq('id', user_id);
    }

    const partnerBaseUrl = task.partner_url;
    const finalRedirectUrl = `${partnerBaseUrl}${partnerBaseUrl.includes('?') ? '&' : '?'}subid=${transaction.id}`;

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        status: 'success',
        transaction_id: transaction.id,
        redirect_url: finalRedirectUrl,
        subid: transaction.id
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ status: 'error', message: error.message })
    };
  }
}