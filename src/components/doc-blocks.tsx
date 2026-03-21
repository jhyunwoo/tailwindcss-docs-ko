import Link from "next/link";

export function DocCallout({
  label,
  href,
  children,
}: {
  label?: string;
  href?: string;
  children: React.ReactNode;
}) {
  const inner = (
    <div className="my-8 rounded-2xl border border-sky-500/20 bg-sky-500/6 px-5 py-4 text-sm/7 text-gray-800 dark:border-sky-400/20 dark:bg-sky-400/8 dark:text-gray-200">
      {label ? <p className="mb-1 font-semibold text-gray-950 dark:text-white">{label}</p> : null}
      <div className="[&_p:first-child]:mt-0 [&_p:last-child]:mb-0">{children}</div>
    </div>
  );

  if (!href) {
    return inner;
  }

  return (
    <Link href={href} className="block no-underline">
      {inner}
    </Link>
  );
}

export function GuideGrid({
  guides,
}: {
  guides: Array<{
    route: string;
    title: string;
    description: string;
  }>;
}) {
  return (
    <div className="not-prose my-10 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {guides.map((guide) => (
        <Link
          key={guide.route}
          href={guide.route}
          className="rounded-2xl border border-gray-950/8 px-5 py-4 transition hover:border-sky-500/30 hover:bg-sky-500/6 dark:border-white/10 dark:hover:border-sky-400/30 dark:hover:bg-sky-400/8"
        >
          <h3 className="text-base font-semibold text-gray-950 dark:text-white">{guide.title}</h3>
          <p className="mt-2 text-sm/6 text-gray-700 dark:text-gray-300">{guide.description}</p>
        </Link>
      ))}
    </div>
  );
}
