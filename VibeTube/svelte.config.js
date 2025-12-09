// svelte.config.js

// 1. Импортируем адаптер для Cloudflare
import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
    // Consult https://svelte.dev/docs/kit/integrations
    // for more information about preprocessors
    preprocess: vitePreprocess(),

    kit: {
        // 2. Используем импортированный адаптер и включаем режим совместимости с Node.js
        adapter: adapter({
            platform: {
                // Включает полифилы для базовых модулей Node.js (fs, path, crypto и др.)
                compatibility: 'nodejs_compat'
            }
        })
    }
};

export default config;
