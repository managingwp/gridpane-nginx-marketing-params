import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - don't use client-side code here (browser APIs, JSX...).

const config: Config = {
  title: 'GridPane marketing params',
  tagline: 'Ignore marketing query parameters in the FastCGI and Redis page cache',
  favicon: 'img/favicon.ico',

  // Deployed from the fork's GitHub Pages site.
  url: 'https://managingwp.github.io',
  baseUrl: '/gridpane-nginx-marketing-params/',

  organizationName: 'managingwp',
  projectName: 'gridpane-nginx-marketing-params',
  trailingSlash: false,

  // A dead link or anchor is a failed build, not a warning.
  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          // The documentation lives at the repository root, not inside the site.
          path: '../docs',
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          editUrl:
            'https://github.com/managingwp/gridpane-nginx-marketing-params/edit/main/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themes: [
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        language: ['en'],
        indexBlog: false,
        docsDir: ['../docs'],
        // Must mirror docs.routeBasePath, or every result links to a 404.
        docsRouteBasePath: '/',
      },
    ],
  ],

  themeConfig: {
    navbar: {
      title: 'GridPane marketing params',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docs',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://github.com/managingwp/gridpane-nginx-marketing-params',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {label: 'Installation', to: '/getting-started/installation'},
            {label: 'How it works', to: '/reference/how-it-works'},
          ],
        },
        {
          title: 'Repository',
          items: [
            {
              label: 'Source and issues',
              href: 'https://github.com/managingwp/gridpane-nginx-marketing-params',
            },
          ],
        },
      ],
      copyright: `Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['nginx', 'bash', 'php', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
