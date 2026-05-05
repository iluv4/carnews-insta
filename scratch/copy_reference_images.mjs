import fs from 'fs';
import path from 'path';

const mapping = {
  'ux_trend_2026': '2026-ux-trend',
  'marketing_crew': 'marketing_crew',
  'magazine_news': '매거진 카드뉴스',
  'english_news_gpt': '영어 카드뉴스_GPT'
};

const baseRefDir = path.join(process.cwd(), 'references/docs/images');
const destDir = path.join(process.cwd(), 'public/templates');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

Object.entries(mapping).forEach(([id, refDirName]) => {
  const srcDirPath = path.join(baseRefDir, refDirName);
  if (fs.existsSync(srcDirPath)) {
    const files = fs.readdirSync(srcDirPath).filter(f => 
      f.toLowerCase().endsWith('.png') || f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg')
    );
    if (files.length > 0) {
      const src = path.join(srcDirPath, files[0]);
      const dest = path.join(destDir, `${id}.png`); // Always save as .png for consistency in the app
      fs.copyFileSync(src, dest);
      console.log(`Copied ${src} to ${dest}`);
    } else {
      console.error(`No image found in ${srcDirPath}`);
    }
  } else {
    console.error(`Directory not found: ${srcDirPath}`);
  }
});
