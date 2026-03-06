export const runtime = "nodejs";

export default async function LeagueLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16, fontFamily: "system-ui" }}>
      {children}
    </div>
  );
}