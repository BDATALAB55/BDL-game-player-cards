import { defineConfig } from 'astro/config';
import tailwind from '@tailwindcss/vite';

import vercel from '@astrojs/vercel';

export default defineConfig({
  vite: {
    plugins: [tailwind()],
  },

  adapter: vercel(),
});