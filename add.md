# Guida: Come Aggiungere Canzoni e Modificare i Nomi

Questa guida spiega come gestire in autonomia i brani musicali all'interno dell'applicazione Bans Player.

## 1. Modificare il nome di una canzone esistente

Se vuoi cambiare il titolo visualizzato di un brano nel player:

1. Apri la cartella del progetto sul tuo computer.
2. Entra nella cartella **`Bans/`** (dove si trovano tutti i file `.mp3`).
3. Trova il file che vuoi rinominare e modificalo (ad esempio, cambia `24OSSESSIONE.mp3` in `24 OSSESSIONE.mp3` o `1 STROBO.mp3` in `1 NUOVO NOME.mp3`).
4. Apri il terminale del computer nella cartella principale del progetto ed esegui il seguente comando per applicare la modifica:
   ```bash
   node generate-playlist.js
   ```

## 2. Aggiungere nuove canzoni

Per inserire nuovi brani nell'applicazione:

1. Prendi i tuoi nuovi file audio (i formati supportati sono `.mp3`, `.m4a`, `.wav`, `.ogg`, `.mpeg`).
2. Copiali all'interno della cartella **`Bans/`**.
3. Rinomina il file in modo che inizi con il numero desiderato per l'ordinamento (ad esempio, `30 NUOVA CANZONE.mp3`).
   *Nota: L'applicazione ordina i brani in base al numero iniziale.*
4. Apri il terminale del computer nella cartella principale del progetto ed esegui il comando:
   ```bash
   node generate-playlist.js
   ```

---

*Fatto! Il file `playlist.json` si aggiornerà automaticamente con le tue modifiche e i nuovi brani compariranno subito all'avvio dell'applicazione.*
