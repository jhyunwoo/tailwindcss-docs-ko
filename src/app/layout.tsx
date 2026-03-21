import type { Metadata } from "next";
import Script from "next/script";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-toggle";

const inter = localFont({
  src: [
    { path: "./fonts/InterVariable.woff2", weight: "100 900", style: "normal" },
    { path: "./fonts/InterVariable-Italic.woff2", weight: "100 900", style: "italic" },
  ],
  variable: "--font-inter",
});

const sourceSans = localFont({
  src: [{ path: "./fonts/SourceSansPro-Regular.ttf.woff2", weight: "500", style: "normal" }],
  variable: "--font-source-sans-pro",
});

const plexMono = localFont({
  src: [
    { path: "./fonts/IBMPlexMono-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/IBMPlexMono-Italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/IBMPlexMono-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/IBMPlexMono-MediumItalic.woff2", weight: "500", style: "italic" },
    { path: "./fonts/IBMPlexMono-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "./fonts/IBMPlexMono-SemiBoldItalic.woff2", weight: "600", style: "italic" },
  ],
  variable: "--font-plex-mono",
});

const ubuntuMono = localFont({
  src: [{ path: "./fonts/Ubuntu-Mono-bold.woff2", weight: "600", style: "normal" }],
  variable: "--font-ubuntu-mono",
});

const js = String.raw;
const darkModeScript = js`
  if (!('_updateTheme' in window)) {
    window._updateTheme = function updateTheme(theme) {
      let classList = document.documentElement.classList;
      classList.remove("light", "dark", "system");
      document.querySelectorAll('meta[name="theme-color"]').forEach((el) => el.remove());
      if (theme === "dark") {
        classList.add("dark");
        let meta = document.createElement("meta");
        meta.name = "theme-color";
        meta.content = "oklch(.13 .028 261.692)";
        document.head.appendChild(meta);
      } else if (theme === "light") {
        classList.add("light");
        let meta = document.createElement("meta");
        meta.name = "theme-color";
        meta.content = "white";
        document.head.appendChild(meta);
      } else {
        classList.add("system");
        let meta1 = document.createElement("meta");
        meta1.name = "theme-color";
        meta1.content = "oklch(.13 .028 261.692)";
        meta1.media = "(prefers-color-scheme: dark)";
        document.head.appendChild(meta1);

        let meta2 = document.createElement("meta");
        meta2.name = "theme-color";
        meta2.content = "white";
        meta2.media = "(prefers-color-scheme: light)";
        document.head.appendChild(meta2);
      }
    };

    try {
      _updateTheme(localStorage.currentTheme);
    } catch (_) {}

    try {
      if (/(Mac|iPhone|iPod|iPad)/i.test(navigator.platform)) {
        document.documentElement.classList.add("os-macos");
      }
    } catch (_) {}
  }
`;

export const metadata: Metadata = {
  title: {
    default: "Tailwind CSS 문서 한국어 미러",
    template: "%s | Tailwind CSS 문서 한국어 미러",
  },
  description: "Tailwind CSS 공식 /docs 문서를 한국어로 옮긴 렌더 가능한 MDX 미러입니다.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${inter.variable} ${sourceSans.variable} ${plexMono.variable} ${ubuntuMono.variable} antialiased dark:bg-gray-950`}
    >
      <head>
        <script type="text/javascript" dangerouslySetInnerHTML={{ __html: darkModeScript }}></script>
        <Script src={`data:text/javascript;base64,${Buffer.from(darkModeScript).toString("base64")}`} />
      </head>
      <body>
        <ThemeProvider>
          <div className="min-h-screen bg-white text-gray-950 dark:bg-gray-950 dark:text-white">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  );
}
