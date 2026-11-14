import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import jsconfigPaths from 'vite-jsconfig-paths';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const appName = env.APP_NAME?.trim() || 'GharMandal';
    const htmlAppName = appName.replace(/[&<>"']/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
    if (mode === 'production' && !env.VITE_API_BASE_URL?.trim()) {
        throw new Error('VITE_API_BASE_URL must be set for production builds.');
    }

    const PORT = 3000;

    return {
        server: {
            // this ensures that the browser opens upon server start
            open: true,
            // this sets a default port to 3000
            port: PORT,
            host: true
        },
        build: {
            chunkSizeWarningLimit: 1600
        },
        preview: {
            open: true,
            host: true
        },
        define: {
            global: 'window',
            'import.meta.env.APP_NAME': JSON.stringify(appName)
        },
        resolve: {
            alias: {
                // { find: '', replacement: path.resolve(__dirname, 'src') },
                // {
                //   find: /^~(.+)/,
                //   replacement: path.join(process.cwd(), 'node_modules/$1')
                // },
                // {
                //   find: /^src(.+)/,
                //   replacement: path.join(process.cwd(), 'src/$1')
                // }
                // {
                //   find: 'assets',
                //   replacement: path.join(process.cwd(), 'src/assets')
                // },
                '@tabler/icons-react': '@tabler/icons-react/dist/esm/icons/index.mjs'
            }
        },
        base: '/',
        plugins: [
            react(),
            jsconfigPaths(),
            {
                name: 'replace-app-name-in-html',
                transformIndexHtml(html) {
                    return html.replace(/%APP_NAME%/g, htmlAppName);
                }
            }
        ]
    };
});
