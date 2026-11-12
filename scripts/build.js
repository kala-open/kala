import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

fs.copyFileSync('index.html', path.join(dist, 'index.html'));
fs.copyFileSync('notch.html', path.join(dist, 'notch.html'));
fs.cpSync('src', path.join(dist, 'src'), { recursive: true });

console.log('Build complete: static assets copied to dist/');

