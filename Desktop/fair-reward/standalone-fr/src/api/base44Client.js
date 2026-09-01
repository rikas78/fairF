// FILE: src/api/base44Client.js
// Client API completo e definitivo di FairReward collegato al backend reale di Base44 (/api)
// Gestisce registrazioni, login e sincronizzazione in remoto nel database anziché locale.

const BASE_URL = '/api';

export const base44Client = {
  /**
   * Registrazione Utente (Database Remoto)
   * Riceve email, password e nome per salvare l'utente nel database remoto della piattaforma.
   */
  async register(email, password, name) {
    const response = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    });
    
    if (!response.ok) {
      throw new Error(`Registrazione fallita con stato: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Se la piattaforma restituisce un token di sessione, lo salviamo
    const token = data.token || data.access_token;
    if (token) {
      localStorage.setItem('fr_token', token);
    }
    
    // Salviamo l'utente nel localStorage per la persistenza
    if (data.user) {
      localStorage.setItem('fr_user', JSON.stringify(data.user));
    } else {
      localStorage.setItem('fr_user', JSON.stringify({ email, name }));
    }
    
    return data;
  },

  /**
   * Login Utente (Database Remoto)
   * Controlla le credenziali dell'utente sul server remoto.
   */
  async login(email, password) {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    if (!response.ok) {
      throw new Error(`Login fallito con stato: ${response.status}`);
    }
    
    const data = await response.json();
    
    const token = data.token || data.access_token;
    if (token) {
      localStorage.setItem('fr_token', token);
    }
    
    if (data.user) {
      localStorage.setItem('fr_user', JSON.stringify(data.user));
    }
    
    return data;
  },

  /**
   * Recupero Profilo Utente / Aggiornamento Saldo
   * Utilizzato per aggiornare in tempo reale il portafoglio dell'utente dopo che il postback è stato completato.
   */
  async getCurrentUser(userId) {
    const token = localStorage.getItem('fr_token');
    const targetUrl = userId ? `${BASE_URL}/users/${userId}` : `${BASE_URL}/auth/me`;
    
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });
    
    if (!response.ok) {
      throw new Error(`Impossibile recuperare i dati dell'utente. Stato: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.user) {
      localStorage.setItem('fr_user', JSON.stringify(data.user));
    }
    return data;
  },

  /**
   * Ottiene la lista dei Task con prezzi REALI direttamente dal database remoto.
   * Filtra automaticamente per i soli compiti verificati.
   */
  async getTasks() {
    const token = localStorage.getItem('fr_token');
    
    const response = await fetch(`${BASE_URL}/tasks`, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });
    
    if (!response.ok) {
      throw new Error(`Impossibile caricare i task dal server. Stato: ${response.status}`);
    }
    
    return await response.json();
  },

  /**
   * Partecipazione al Task
   * Registra l'avvio del compito sul database remoto e genera il link con subid dinamico.
   * Gestisce il meccanismo di idempotenza e attiva il co-finanziamento immediato se previsto.
   */
  async participate(userId, taskId, idempotencyKey) {
    const token = localStorage.getItem('fr_token');
    
    const response = await fetch(`${BASE_URL}/participate`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        'Idempotency-Key': idempotencyKey || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2))
      },
      body: JSON.stringify({ user_id: userId, task_id: taskId })
    });
    
    if (!response.ok) {
      throw new Error(`Impossibile registrare la partecipazione. Stato: ${response.status}`);
    }
    
    return await response.json();
  },

  /**
   * Richiesta di Prelievo (Cassa)
   * Registra una richiesta di payout reale dal saldo dell'utente.
   */
  async requestPayout(userId, amount) {
    const token = localStorage.getItem('fr_token');
    
    const response = await fetch(`${BASE_URL}/payouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ user_id: userId, amount: Number(amount) })
    });
    
    if (!response.ok) {
      throw new Error(`Richiesta di prelievo fallita. Stato: ${response.status}`);
    }
    
    return await response.json();
  },

  /**
   * Log-out
   * Pulisce la sessione locale per sicurezza.
   */
  logout() {
    localStorage.removeItem('fr_token');
    localStorage.removeItem('fr_user');
  }
};

export default base44Client;
