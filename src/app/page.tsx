import CardGenerator from "@/components/CardGenerator";

export default function Home() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "64px 24px" }}>
      <div style={{ textAlign: "center", marginBottom: "48px", animation: "fadeIn 0.8s ease-out" }}>
        <h1 style={{ fontSize: "3rem", fontWeight: "700", marginBottom: "16px", background: "linear-gradient(135deg, #f8fafc, #94a3b8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          InstaCard AI
        </h1>
        <p style={{ fontSize: "1.125rem", color: "var(--text-secondary)", maxWidth: "600px", margin: "0 auto", lineHeight: "1.6" }}>
          Transform your Instagram photos into stunning, themed card news in seconds using the power of AI.
        </p>
      </div>

      <CardGenerator />
      
      <footer style={{ marginTop: "auto", paddingTop: "64px", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
        Powered by Next.js & OpenAI DALL-E 3
      </footer>
    </main>
  );
}
