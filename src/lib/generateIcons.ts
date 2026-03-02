// アプリアイコン生成スクリプト（Node.jsで実行）
// 使い方: npx tsx src/lib/generateIcons.ts

function generateIconSVG(size: number): string {
  const padding = size * 0.15;
  const innerSize = size - padding * 2;
  const cx = size / 2;
  const cy = size / 2;
  const checkSize = innerSize * 0.4;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6"/>
      <stop offset="100%" style="stop-color:#2563eb"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#bg)"/>
  <circle cx="${cx}" cy="${cy}" r="${innerSize * 0.32}" fill="none" stroke="white" stroke-width="${size * 0.04}"/>
  <polyline points="${cx - checkSize * 0.35},${cy + checkSize * 0.05} ${cx - checkSize * 0.05},${cy + checkSize * 0.35} ${cx + checkSize * 0.4},${cy - checkSize * 0.25}" fill="none" stroke="white" stroke-width="${size * 0.045}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

// Canvas APIでPNGを生成（ブラウザ用のフォールバック）
// このスクリプトはSVGを出力するだけ。PNGはオンラインツールで変換するか、
// 以下のコマンドで変換可能:
// npx sharp-cli -i icon.svg -o icon-192.png -w 192 -h 192
// npx sharp-cli -i icon.svg -o icon-512.png -w 512 -h 512

import { writeFileSync } from 'fs';
import { join } from 'path';

const publicDir = join(process.cwd(), 'public');

// SVGを保存
writeFileSync(join(publicDir, 'icon.svg'), generateIconSVG(512));

console.log('icon.svg を public/ に生成しました');
console.log('PNGアイコンの生成:');
console.log('  npx @aspect-build/rules_js sharp -i public/icon.svg -o public/icon-192.png resize 192 192');
console.log('  または https://svgtopng.com/ で変換してください');
