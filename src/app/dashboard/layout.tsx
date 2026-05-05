import Navbar from "@/components/Navbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--background)' }}>
      <Navbar />
      <main style={{ flex: 1, overflowY: 'auto' }}>
        <div className="main-content">
          {children}
        </div>
      </main>
    </div>
  );
}
