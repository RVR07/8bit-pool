export const metadata = {
  title: 'Billiards',
  description: 'Eight ball'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#101114', overflow: 'hidden' }}>{children}</body>
    </html>
  );
}
