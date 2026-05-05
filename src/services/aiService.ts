import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export const aiService = {
  async analyzeImage(base64Image: string) {
    const response = await openai.chat.completions.create({
      model: "gpt-5.5",
      messages: [
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: "Analyze this card news image. Extract layout, colors, and text. Output STRICTLY JSONL." 
            },
            {
              type: "image_url",
              image_url: { url: base64Image },
            },
          ],
        },
      ],
      max_completion_tokens: 1000,
    });

    return response.choices[0].message.content;
  },

  async generateCard(jsonlAnalysis: string, theme: string) {
    const prompt = `Create a professional Instagram card news image based on this structural analysis:
    ${jsonlAnalysis}
    Theme: ${theme}. 
    Include actual text content from analysis. Typography must be beautiful.`;

    const response = await openai.images.generate({
      model: "gpt-image-2", // or fallback to dall-e-3
      prompt,
      n: 1,
      size: "1024x1792",
    });

    return response.data[0].url;
  }
};
