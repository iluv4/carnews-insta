import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const templates = [
  { id: 'ux_trend_2026', prompt: "A premium Instagram card news template for '2026 UX Trend'. Futuristic 3D design, neon accents, cyber-tech aesthetic, high-quality professional layout." },
  { id: 'marketing_crew', prompt: "High-end marketing recruitment Instagram card news template. Vibrant purple and indigo gradients, energetic design, 3D elements." },
  { id: 'magazine_news', prompt: "Clean, photo-centric professional magazine layout for travel and lifestyle." },
  { id: 'english_news_gpt', prompt: "Educational focused English learning card news with emphasis on keywords and clean layout." }
];

async function generate() {
  for (const template of templates) {
    console.log(`Generating for ${template.id}...`);
    try {
      let response;
      try {
        // Try GPT Image-2 as per user's code
        response = await openai.images.generate({
          model: "gpt-image-2",
          prompt: template.prompt,
          n: 1,
          size: "1024x1024",
        });
      } catch (e) {
        console.warn(`GPT Image-2 failed for ${template.id}, falling back to DALL-E 3`);
        response = await openai.images.generate({
          model: "dall-e-3",
          prompt: template.prompt,
          n: 1,
          size: "1024x1024",
        });
      }

      const imageUrl = response.data[0].url;
      const imageRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const outputPath = path.join(process.cwd(), 'public/templates', `${template.id}.png`);
      
      // Ensure directory exists
      if (!fs.existsSync(path.dirname(outputPath))) {
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      }
      
      fs.writeFileSync(outputPath, imageRes.data);
      console.log(`Saved to ${outputPath}`);
    } catch (error) {
      console.error(`Failed to generate ${template.id}:`, error.message);
    }
  }
}

generate();
