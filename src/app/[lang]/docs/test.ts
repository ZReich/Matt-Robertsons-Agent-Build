import "server-only";
import fs from "fs";
import path from "path";
import { LocaleType } from "@/configs/i18n";
import { ensureLocalizedPathname } from "@/lib/i18n";

// interface DocItem {
//   title: string;
//   href: string;
// }

interface DocSection {
  title: string;
  items?: DocSection[]; // Optional for sections with nested items
  href?: string; // Optional for sections with a page.mdx
}

function findDocs(
  dir: string,
  basePath: string,
  locale: LocaleType
): Array<DocSection | DocSection> {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const result: Array<DocSection | DocSection> = [];

  entries.forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(basePath, fullPath);
    const href = `docs/${relativePath.replace(/\\/g, "/")}`;

    if (entry.isDirectory()) {
      const subEntries = fs.readdirSync(fullPath, { withFileTypes: true });
      const pageMdxExists = subEntries.some(
        (subEntry) => subEntry.isFile() && subEntry.name === "page.mdx"
      );

      const nestedItems = findDocs(fullPath, basePath, locale);

      if (pageMdxExists) {
        // Add the directory as a section with href and optional items
        result.push({
          title:
            entry.name.charAt(0).toUpperCase() +
            entry.name.slice(1).replace(/-/g, " "),
          href: ensureLocalizedPathname(`/${href}`, locale),
          items: nestedItems,
        });
      } else if (nestedItems.length > 0) {
        // Add the directory as a section without href if no page.mdx
        result.push({
          title:
            entry.name.charAt(0).toUpperCase() +
            entry.name.slice(1).replace(/-/g, " "),
          items: nestedItems.map((item) => ({
            title: (item as DocSection).title || (item as DocSection).title,
            href: (item as DocSection).href || "",
          })),
        });
      }
    }
  });

  return result;
}

export function getDocsSidebar(
  locale: LocaleType
): Array<DocSection | DocSection> {
  const docsDir = path.join(process.cwd(), "src", "app", "[lang]", "docs");
  return findDocs(docsDir, docsDir, locale);
}
