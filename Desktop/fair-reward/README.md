# FairReward 50/50 — App Standalone (Netlify + Supabase)

Questa cartella `standalone/` contiene la webapp completa, indipendente da Base44,
pronta per essere deployata su **Netlify** con database **Supabase**.

## Struttura
- `index.html` — frontend (tema dark navy + smeraldo + oro), login, dashboard, task, modale.
- `netlify/functions/auth.js` — login/creazione account con bonus €2.00.
- `netlify/functions/tasks.js` — lista task (fonte unica per card e modale).
- `netlify/functions/participate.js` — attivazione 50/50 + idempotenza (header `Idempotency-Key`).
- `netlify/functions/postback.js` — postback CPAlead: accredita il reward al saldo.
- `netlify/functions/package.json` — dipendenze funzioni.
- `supabase/migration.sql` — schema tabelle + seed task.
- `netlify.toml` — configurazione deploy Netlify.

## Deploy
1. Esegui `supabase/migration.sql` nel SQL Editor di Supabase.
2. Crea un progetto su Netlify da questa cartella (oppure pusha su GitHub e collega il repo).
3. Imposta le variabili ambiente su Netlify:
   - `SUPABASE_URL` = https://<tuo-progetto>.supabase.co
   - `SUPABASE_SERVICE_ROLE_KEY` = <service_role_key>
   - `CPALEAD_SECRET` = (opzionale, per validare i postback CPAlead)
4. Su CPAlead imposta il Postback URL: `https://<tuo-dominio-netlify>/.netlify/functions/postback`
   e, se hai impostato `CPALEAD_SECRET`, aggiungi il parametro `&secret=<valore>`.

## Flusso
1. Login con email → `auth` crea l'utente con €2.00 di saldo (persistito in localStorage).
2. Dashboard mostra saldo reale e i task.
3. "Avvia" → modale di conferma 50/50 → `participate` riserva la quota e reindirizza al partner (con `subid`).
4. CPAlead, a conferma completata, chiama `postback` → accredita stake + guadagno netto al saldo.
5. Al ritorno/ricarica, il saldo viene aggiornato dal database.