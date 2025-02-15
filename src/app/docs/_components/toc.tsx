"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function Toc() {
  const [toc, setToc] = useState<TocItem[]>([]);
  const pathname = usePathname();

  useEffect(() => {
    const content = document.getElementById("mdx-content");
    if (content) {
      const tocItems = generateToc(content, "#mdx-content");
      setToc(tocItems);

      // Apply generated IDs to all headings without IDs
      const headings = content.querySelectorAll("h2, h3, h4");
      headings.forEach((heading, index) => {
        if (!heading.id && tocItems[index]) {
          heading.id = tocItems[index].id;
        }
      });
    }
  }, [pathname]);

  return <TableOfContents items={toc} />;
}

export interface TocItem {
  id: string;
  title: string;
  level: number;
  children?: TocItem[];
}

export function generateToc(content: HTMLElement, selector: string): TocItem[] {
  const headings = Array.from(
    content.querySelectorAll(`${selector} h2, ${selector} h3, ${selector} h4`)
  );
  const toc: TocItem[] = [];
  const stack: TocItem[] = [];
  const usedIds = new Set<string>();

  headings.forEach((heading) => {
    const level = parseInt(heading.tagName.charAt(1), 10);
    const title = heading.textContent?.trim() || "";
    let id = heading.id || slugify(title);

    // Ensure unique ID
    let uniqueId = id;
    let counter = 1;
    while (usedIds.has(uniqueId)) {
      uniqueId = `${id}-${counter}`;
      counter++;
    }
    usedIds.add(uniqueId);

    // Assign unique ID back to the heading (optional but helpful)
    heading.id = uniqueId;

    const item: TocItem = { id: uniqueId, title, level, children: [] };

    // Maintain hierarchy using stack
    while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
      stack.pop();
    }

    if (stack.length > 0) {
      // @ts-ignore
      stack[stack.length - 1].children.push(item);
    } else {
      toc.push(item);
    }

    stack.push(item);
  });

  return toc;
}

// Utility function for slugifying text
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric chars with "-"
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing dashes
}

interface TableOfContentsProps {
  items: TocItem[];
}

export function TableOfContents({ items }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>("");
  const { isMobile } = useSidebar();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "0px 0px -60% 0px" }
    );

    const headers = document.querySelectorAll(
      "#mdx-content h2, #mdx-content h3, #mdx-content h4"
    );
    headers.forEach((header) => observer.observe(header));

    return () => {
      headers.forEach((header) => observer.unobserve(header));
      setActiveId("");
    };
  }, [items]);

  const renderItems = (items: TocItem[]) => {
    return (
      <ul className="space-y-2 text-sm">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={`block py-1 ${
                activeId === item.id
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.title}
            </a>
            {item.children && item.children.length > 0 && (
              <ul className="ms-4 mt-2 space-y-2 text-sm">
                {renderItems(item.children)}
              </ul>
            )}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <aside
      className={cn(
        "shrink-0 sticky top-0 bottom-0 end-0 w-64 hidden bg-background",
        !isMobile && " block"
      )}
    >
      <nav
        className={cn(
          "mt-16 h-[calc(100svh-4rem)] border-s-[1px] border-sidebar-border",
          items.length <= 0 && "hidden"
        )}
      >
        <ScrollArea className="h-full p-4">
          <h2 className="text-sm font-medium mb-4">On this page</h2>
          {renderItems(items)}
        </ScrollArea>
      </nav>
    </aside>
  );
}
