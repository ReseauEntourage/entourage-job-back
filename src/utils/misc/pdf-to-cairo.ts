import fs from 'fs';

export function detectPdftocairoPath() {
  const candidates = [
    '/opt/homebrew/bin/pdftocairo', // Mac M1/M2
    '/usr/local/bin/pdftocairo', // Mac Intel
    '/app/.apt/usr/bin/pdftocairo', // Heroku (poppler buildpack)
    '/usr/bin/pdftocairo', // Linux générique
  ];

  for (const path of candidates) {
    if (fs.existsSync(path)) return path;
  }

  throw new Error(
    'pdftocairo introuvable. Installez Poppler localement ou ajoutez le buildpack sur Heroku.'
  );
}
