import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

const base = process.env.BASE_PATH ?? '/wattwhere';
const site = process.env.SITE_URL ?? 'https://muhammad-hazimi-yusri.github.io';

export default defineConfig({
  site,
  base,
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [mdx(), react(), tailwind({ applyBaseStyles: false })],
  vite: {
    assetsInclude: ['**/*.pmtiles'],
  },
});
