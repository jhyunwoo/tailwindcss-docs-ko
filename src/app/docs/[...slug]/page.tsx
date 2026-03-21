import { notFound } from "next/navigation";
import { DocsShell } from "@/components/docs-shell";
import { getDocPage, getDocRoutes, getNavigationSections, getTabSiblings, joinRouteSlug } from "@/lib/docs";

type PageProps = {
  params: Promise<{ slug: string[] }>;
};

export async function generateStaticParams() {
  return getDocRoutes().map((route) => ({
    slug: route.replace(/^\/docs\//, "").split("/"),
  }));
}

export default async function DocsPage({ params }: PageProps) {
  const slug = joinRouteSlug((await params).slug);
  const page = await getDocPage(slug);
  if (!page) {
    notFound();
  }

  const sections = getNavigationSections();
  const tabs = getTabSiblings(page.entry);
  const Content = page.module.default;
  const title = page.module.title ?? page.entry.title;
  const description = page.module.description ?? page.entry.description ?? "";

  return (
    <DocsShell
      sections={sections}
      entry={page.entry}
      tabs={tabs}
      currentRoute={page.entry.route}
      title={title}
      description={description}
    >
      <Content />
    </DocsShell>
  );
}
