# Instagram Card News Generator

A Next.js web application that automates the creation of visually appealing card news content for Instagram. The application extracts image data from an Instagram URL and utilizes OpenAI's DALL-E 3 to transform and generate new card news background images based on a provided theme and aesthetic reference.

## Features

- **Instagram Link Scraping:** Easily fetch image data directly from Instagram post URLs. (Note: Uses fallback images if Instagram blocks the scraping request).
- **AI-Powered Image Generation:** Integrates with OpenAI's DALL-E 3 to generate high-quality, vertical images suited for card news formats based on your specific theme and style references.
- **Modern UI:** Built with Next.js and React, featuring a clean and interactive interface for previewing and customizing your generated card news.

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router)
- **Library:** [React](https://react.dev/)
- **Styling:** CSS Modules
- **Web Scraping:** [Cheerio](https://cheerio.js.org/) & [Axios](https://axios-http.com/)
- **AI Integration:** [OpenAI API](https://platform.openai.com/docs/api-reference) (DALL-E 3)

## Prerequisites

Before running the project locally, make sure you have the following installed:
- Node.js (v18 or higher recommended)
- npm, yarn, pnpm, or bun

You will also need an **OpenAI API Key** to enable the AI image generation features.

## Environment Variables

Create a `.env.local` file in the root directory of the project and add your OpenAI API Key:

```env
OPENAI_API_KEY=your_openai_api_key_here
```
*(If the API key is not provided, the application will run in simulated mode and return placeholder images).*

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   ```

2. **Run the development server:**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

3. **Open the app:**
   Open [http://localhost:3000](http://localhost:3000) with your browser to see the application in action.

## Project Structure

- `src/app/page.tsx`: The main application page containing the UI.
- `src/components/CardGenerator.tsx`: The core component handling the form inputs and displaying the generated card news preview.
- `src/app/api/instagram/route.ts`: API route for scraping Instagram URLs.
- `src/app/api/transform/route.ts`: API route handling the OpenAI DALL-E 3 prompt and image generation.

## Future Enhancements
- Text overlay capabilities to place headlines directly onto the generated backgrounds.
- Integration with GPT-4V for analyzing the original Instagram image before transformation.
- Download functionality for the finalized card news images.
