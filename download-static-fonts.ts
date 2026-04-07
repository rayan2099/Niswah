import https from 'https';
import fs from 'fs';
import path from 'path';

const fontsDir = path.join(process.cwd(), 'public', 'fonts');

if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}

const fonts = [
  {
    url: 'https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hOA-W1Q.ttf',
    filename: 'Cairo-Regular-Static.ttf'
  },
  {
    url: 'https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hAc5W1Q.ttf',
    filename: 'Cairo-Bold-Static.ttf'
  }
];

async function downloadFont(url: string, filename: string) {
  const dest = path.join(fontsDir, filename);
  console.log(`Downloading ${url} to ${dest}...`);
  
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        // Handle redirects
        downloadFont(res.headers.location!, filename).then(resolve).catch(reject);
        return;
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download font: ${res.statusCode}`));
        return;
      }

      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded ${filename} successfully.`);
        resolve(true);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  for (const font of fonts) {
    try {
      await downloadFont(font.url, font.filename);
    } catch (err) {
      console.error(`Error downloading ${font.filename}:`, err);
    }
  }
}

main();
