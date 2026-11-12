import type { Metadata } from "next";
import { Inter, Noto_Sans_JP, Noto_Serif_JP } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import ElectronNavigator from "@/components/ElectronNavigator";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-jp",
});
const notoSerifJP = Noto_Serif_JP({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-serif-jp",
});

export const metadata: Metadata = {
  title: "言葉 Kotoba — Japanese & English Learning",
  description: "Translate Japanese and English into Thai, with word-level teaching and flashcard review.",
};

// Runs before paint to avoid a light/dark flash on load.
const themeBootstrapScript = `
(function() {
  try {
    var raw = window.localStorage.getItem('kotoba.settings.v1');
    var theme = raw ? JSON.parse(raw).theme : 'light';
    if (theme === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className={`${inter.variable} ${notoSansJP.variable} ${notoSerifJP.variable} font-sans antialiased`}>
        <div className="flex min-h-screen">
          <Sidebar />
          <ElectronNavigator />
          <main className="flex-1 min-w-0 md:ml-64 pb-20 md:pb-0">{children}</main>
        </div>
      </body>
    </html>
  );
}
