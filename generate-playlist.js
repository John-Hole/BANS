const fs = require('fs');
const path = require('path');

// Configurazione cartelle di ricerca
const SEARCH_DIRS = ['Bans', 'fonti'];
let selectedDir = '';

// Trova la prima cartella esistente tra quelle configurate
for (const dir of SEARCH_DIRS) {
  const fullPath = path.join(__dirname, dir);
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
    selectedDir = dir;
    break;
  }
}

if (!selectedDir) {
  console.error(`Errore: nessuna delle cartelle [${SEARCH_DIRS.join(', ')}] trovata nel progetto.`);
  process.exit(1);
}

const dirPath = path.join(__dirname, selectedDir);
console.log(`Scansione della cartella audio: "${selectedDir}"...`);

// Estensioni supportate
const SUPPORTED_EXTENSIONS = ['.mp3', '.m4a', '.wav', '.ogg', '.mpeg'];

// Legge i file della cartella
let files = [];
try {
  files = fs.readdirSync(dirPath);
} catch (err) {
  console.error(`Impossibile leggere la cartella ${selectedDir}:`, err);
  process.exit(1);
}

const tracks = [];

files.forEach((fileName) => {
  const ext = path.extname(fileName).toLowerCase();
  if (SUPPORTED_EXTENSIONS.includes(ext)) {
    const filePath = path.join(dirPath, fileName);
    const stats = fs.statSync(filePath);
    
    // Nome pulito senza estensione
    const cleanName = fileName.slice(0, -ext.length);
    
    // Percorso relativo da usare nel browser (es. Bans/1 STROBO.mp3)
    // Usiamo le slash in avanti per compatibilità URL nel web
    const relativeUrl = `${selectedDir}/${fileName}`;

    tracks.push({
      id: relativeUrl, // Usiamo il percorso relativo come ID univoco
      name: cleanName,
      fileName: fileName,
      file: relativeUrl,
      size: stats.size
    });
  }
});

// Funzione di ordinamento intelligente
// 1. Estrae l'eventuale prefisso numerico (es. "1", "10", "24")
// 2. Se presenti numeri, ordina per numero
// 3. Se non presenti numeri, ordina alfabeticamente
// 4. I brani numerati vengono prima di quelli non numerati
tracks.sort((a, b) => {
  const matchA = a.name.match(/^(\d+)/);
  const matchB = b.name.match(/^(\d+)/);
  
  if (matchA && matchB) {
    const numA = parseInt(matchA[1], 10);
    const numB = parseInt(matchB[1], 10);
    return numA - numB;
  } else if (matchA) {
    return -1; // a ha il numero, va prima
  } else if (matchB) {
    return 1;  // b ha il numero, va prima
  } else {
    return a.name.localeCompare(b.name); // Ordinamento alfabetico standard
  }
});

// Scrittura del file playlist.json nella root
const outputPath = path.join(__dirname, 'playlist.json');
try {
  fs.writeFileSync(outputPath, JSON.stringify(tracks, null, 2), 'utf8');
  console.log(`Successo! Generato playlist.json con ${tracks.length} brani.`);
  console.log(`File salvato in: ${outputPath}`);
} catch (err) {
  console.error('Errore durante la scrittura di playlist.json:', err);
  process.exit(1);
}
