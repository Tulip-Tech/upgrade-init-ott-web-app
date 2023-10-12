import path from 'path';
import fs from 'fs';

import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import type { ConfigEnv, UserConfigExport } from 'vitest/config';
import react from '@vitejs/plugin-react';
import eslintPlugin from 'vite-plugin-eslint';
import StylelintPlugin from 'vite-plugin-stylelint';
import { VitePWA } from 'vite-plugin-pwa';
import { createHtmlPlugin } from 'vite-plugin-html';
import { Target, viteStaticCopy } from 'vite-plugin-static-copy';

function CapacitorPlugin(): Plugin {
  return {
    name: 'capacitor-plugin',
    enforce: 'pre',
    resolveId: async function (specifier, importer) {
      const srcPath = path.join(__dirname, 'src');
      const capacitorId = specifier + '.capacitor';
      const extensions = ['ts', 'tsx'];
      const cleanSpecifier = specifier.split('?')[0]; // remove the params
      const scssExtension = '.scss';
      const scssCapacitorPath = specifier.includes('.module.scss')
        ? cleanSpecifier.replace('.module.scss', '.capacitor.module.scss')
        : cleanSpecifier.replace('.scss', '.capacitor.scss');

      // replace SCSS variants
      if (cleanSpecifier.endsWith(scssExtension) && importer) {
        const scssAbsolutePath = scssCapacitorPath.startsWith(srcPath)
          ? scssCapacitorPath // already an absolute path
          : path.join(path.dirname(importer), scssCapacitorPath); // relative path -> absolute path

        try {
          await fs.promises.access(scssAbsolutePath);
          // the variant exists
          return scssAbsolutePath;
        } catch (error: unknown) {
          // the file doesn't exist
          return null;
        }
      }

      // we're loading a file from the ./src folder
      if (specifier.startsWith(srcPath) && importer !== capacitorId) {
        for (const extensionsKey of extensions) {
          try {
            await fs.promises.access(`${capacitorId}.${extensionsKey}`);

            return `${capacitorId}.${extensionsKey}`;
          } catch (error: unknown) {
            // not found
          }
        }
      }
    },
  };
}

export default ({ mode, command }: ConfigEnv): UserConfigExport => {
  // Shorten default mode names to dev / prod
  // Also differentiates from build type (production / development)
  mode = mode === 'development' ? 'dev' : mode;
  mode = mode === 'production' ? 'prod' : mode;

  const localFile = `ini/.webapp.${mode}.ini`;
  const templateFile = `ini/templates/.webapp.${mode}.ini`;

  // The build ONLY uses .ini files in /ini to include in the build output.
  // All .ini files in the directory are git ignored to customer specific values out of source control.
  // However, this script will automatically create a .ini file for the current mode if it doesn't exist
  // by copying the corresponding mode file from the ini/templates directory.
  if (!fs.existsSync(localFile) && fs.existsSync(templateFile)) {
    fs.copyFileSync(templateFile, localFile);
  }

  // Make sure to builds are always production type,
  // otherwise modes other than 'production' get built in dev
  if (command === 'build') {
    process.env.NODE_ENV = 'production';
  }

  const fileCopyTargets: Target[] = [
    {
      src: localFile,
      dest: '',
      rename: '.webapp.ini',
    },
  ];

  // These files are only needed in dev / test / demo, so don't include in prod builds
  if (mode !== 'prod') {
    fileCopyTargets.push({
      src: 'test/epg/*',
      dest: 'epg',
    });
  }

  return defineConfig({
    plugins: [
      CapacitorPlugin(),
      react(),
      eslintPlugin({ emitError: mode === 'production' || mode === 'demo' || mode === 'preview' }), // Move linting to pre-build to match dashboard
      StylelintPlugin(),
      VitePWA(),
      createHtmlPlugin({
        minify: true,
        inject: process.env.APP_GOOGLE_SITE_VERIFICATION_ID
          ? {
              tags: [
                {
                  tag: 'meta',
                  injectTo: 'head',
                  attrs: {
                    content: process.env.APP_GOOGLE_SITE_VERIFICATION_ID,
                    name: 'google-site-verification',
                  },
                },
              ],
            }
          : {},
      }),
      viteStaticCopy({
        targets: fileCopyTargets,
      }),
    ],
    define: {
      'import.meta.env.APP_VERSION': JSON.stringify(process.env.npm_package_version),
    },
    publicDir: './public',
    envPrefix: 'APP_',
    server: {
      port: 8080,
    },
    mode: mode,
    build: {
      outDir: './build/public',
      cssCodeSplit: false,
      minify: true,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // I originally just wanted to separate react-dom as its own bundle,
            // but you get an error at runtime without these dependencies
            if (
              id.includes('/node_modules/react-dom/') ||
              id.includes('/node_modules/scheduler/') ||
              id.includes('/node_modules/object-assign/') ||
              id.includes('/node_modules/react/')
            ) {
              return 'react';
            }
            if (id.includes('/node_modules/@inplayer')) {
              return 'inplayer';
            }
            if (id.includes('/node_modules/')) {
              return 'vendor';
            }
            return 'index';
          },
        },
      },
    },
    css: {
      devSourcemap: true,
    },
    resolve: {
      alias: {
        '#src': path.join(__dirname, 'src'),
        '#components': path.join(__dirname, 'src/components'),
        '#test': path.join(__dirname, 'test'),
        '#test-e2e': path.join(__dirname, 'test-e2e'),
        '#types': path.join(__dirname, 'types'),
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['test/vitest.setup.ts'],
      css: true,
    },
  });
};
