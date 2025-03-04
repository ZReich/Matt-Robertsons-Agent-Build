import createMDX from "@next/mdx";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure `pageExtensions` to include markdown and MDX files
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],

  // See https://lucide.dev/guide/packages/lucide-react#nextjs-example
  transpilePackages: ["lucide-react"],

  // See https://nextjs.org/docs/messages/next-image-unconfigured-host
  // See https://nextjs.org/docs/pages/api-reference/components/image#remotepatterns
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },

  async redirects() {
    return [
      {
        source: "/:lang/apps/email",
        destination: "/:lang/apps/email/inbox",
        permanent: true,
      },
      {
        source: "/",
        destination: process.env.HOME_PATHNAME || "/",
        permanent: true,
      },
      {
        source: "/docs",
        destination: "/docs/overview/introduction",
        permanent: true,
      },
    ];
  },

  webpack(config) {
    // Grab the existing rule that handles SVG imports
    const fileLoaderRule = config.module.rules.find((rule) =>
      rule.test?.test?.(".svg")
    );

    config.module.rules.push(
      // Reapply the existing rule, but only for svg imports ending in ?url
      {
        ...fileLoaderRule,
        test: /\.svg$/i,
        resourceQuery: /url/, // *.svg?url
      },
      // Convert all other *.svg imports to React components
      {
        test: /\.svg$/i,
        issuer: fileLoaderRule.issuer,
        resourceQuery: { not: [...fileLoaderRule.resourceQuery.not, /url/] }, // exclude if *.svg?url
        use: [
          {
            loader: "@svgr/webpack",
            options: {
              // Add your SVGR options here
              icon: true,
              svgo: true,
              typescript: true,
            },
          },
        ],
      }
    );

    // Modify the file loader rule to ignore *.svg, since we have it handled now.
    fileLoaderRule.exclude = /\.svg$/i;

    return config;
  },
};

const withMDX = createMDX({
  // Add markdown plugins here, as desired
});

// Merge MDX config with Next.js config
export default withMDX(nextConfig);
