"use client";

import Link from "next/link";
import { useMemo } from "react";
import ThemeToggle from "@/components/theme-toggle";
import type { DocManifestEntry, NavigationSection } from "@/lib/docs";
import { clsx } from "clsx";

export function DocsShell({
  sections,
  entry,
  tabs,
  currentRoute,
  title,
  description,
  children,
}: {
  sections: NavigationSection[];
  entry: DocManifestEntry;
  tabs: DocManifestEntry[];
  currentRoute: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const pageTitle = useMemo(() => title.replace(/\s+-\s+Tailwind CSS$/, ""), [title]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-gray-950/8 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-gray-950/85">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-4 py-3 sm:px-6">
          <div>
            <Link href="/docs" className="text-lg font-semibold tracking-tight">
              Tailwind CSS Docs KO
            </Link>
            <p className="text-sm text-gray-600 dark:text-gray-400">공식 `/docs/*` 문서 한국어 MDX 미러</p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-0 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border-b border-gray-950/8 px-4 py-6 lg:sticky lg:top-[73px] lg:h-[calc(100vh-73px)] lg:overflow-y-auto lg:border-r lg:border-b-0 lg:px-6 dark:border-white/10">
          <nav className="space-y-8">
            {sections.map((section) => (
              <div key={section.title}>
                <h2 className="font-mono text-xs/6 tracking-widest text-gray-500 uppercase dark:text-gray-400">
                  {section.title}
                </h2>
                <ul className="mt-3 space-y-1.5">
                  {section.items.map((item) => (
                    <li key={item.route}>
                      <Link
                        href={item.route}
                        className={clsx(
                          "block rounded-lg px-3 py-2 text-sm/6 transition",
                          item.route === currentRoute
                            ? "bg-sky-500/12 font-medium text-sky-700 dark:bg-sky-400/15 dark:text-sky-300"
                            : "text-gray-700 hover:bg-gray-950/5 dark:text-gray-300 dark:hover:bg-white/5",
                        )}
                      >
                        {item.navTitle}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <main className="px-4 py-10 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-4xl">
            <p className="font-mono text-xs/6 tracking-widest text-gray-500 uppercase dark:text-gray-400">
              {entry.section}
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">{pageTitle}</h1>
            {description ? <p className="mt-5 max-w-3xl text-base/7 text-gray-700 dark:text-gray-300">{description}</p> : null}
            {tabs.length > 1 ? (
              <div className="mt-8 flex flex-wrap gap-2">
                {tabs.map((tab) => (
                  <Link
                    key={tab.route}
                    href={tab.route}
                    className={clsx(
                      "rounded-full border px-3 py-1.5 text-sm transition",
                      tab.route === currentRoute
                        ? "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:border-sky-400/30 dark:bg-sky-400/15 dark:text-sky-300"
                        : "border-gray-950/10 text-gray-700 hover:bg-gray-950/5 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5",
                    )}
                  >
                    {tab.tabLabel ?? tab.navTitle}
                  </Link>
                ))}
              </div>
            ) : null}
            <article className="prose prose-gray mt-10 max-w-none dark:prose-invert">{children}</article>
          </div>
        </main>
      </div>
    </div>
  );
}
