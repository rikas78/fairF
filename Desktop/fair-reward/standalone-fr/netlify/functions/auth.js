import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Metodo non consentito' };
  }

  try {
    const { email } = JSON.parse(event.body);
    if (!email) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ status: 'error', message: 'Email obbligatoria' }) 
      };
    }

    let { data: user, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (findError) throw findError;

    if (!user) {
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert([{ email, balance: 2.00, pending_balance: 0.00 }])
        .select('*')
        .single();

      if (createError) throw createError;
      user = newUser;
    }

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ status: 'success', user })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ status: 'error', message: error.message })
    };
  }
}
netlify/functions/tasks.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Metodo non consentito' };
  }

  try {
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('is_verified', true);

    if (error) throw error;

    const formattedTasks = tasks.map(task => {
      const rawReward = Number(task.total_reward || 0);
      const expensePercentage = Number(task.expense_percentage || 25);
      const expenses = rawReward * (expensePercentage / 100);
      const netEarnings = rawReward - expenses;
      const userShare = Number((netEarnings * 0.5).toFixed(2));

      return {
        id: task.id,
        title: task.title,
        description: task.description,
        partner_url: task.partner_url || '',
        quota_total: task.required_quota || 0,
        net_reward: userShare,
        expense_percentage: expensePercentage,
        entry_cost: task.entry_cost || 0,
        video_url: task.video_url || '',
        credit_time: task.credit_time || '24-48 ore'
      };
    });

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ status: 'success', tasks: formattedTasks })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ status: 'error', message: error.message })
    };
  }
}