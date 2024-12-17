export interface DocNav {
  title: string;
  items?: DocNav[]; // Optional for sections with nested items
  href?: string; // Optional for sections with a page.mdx
}
