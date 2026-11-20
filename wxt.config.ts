import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Detached',
    description: 'Keep video or audio within reach in a floating player.',
    permissions: ['activeTab', 'scripting'],
    minimum_chrome_version: '116',
  },
  hooks: {
    'build:publicAssets': ({ config }, files) => {
      files.push({ absoluteSrc: `${config.root}/LICENSE`, relativeDest: 'LICENSE' });
    },
  },
});
