import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Detached',
    description: 'Keep video or audio within reach in a floating player.',
    permissions: ['activeTab', 'scripting'],
    minimum_chrome_version: '116',
    icons: {
      16: 'icons/detached-16.png',
      32: 'icons/detached-32.png',
      48: 'icons/detached-48.png',
      128: 'icons/detached-128.png',
    },
    action: {
      default_icon: {
        16: 'icons/detached-16.png',
        24: 'icons/detached-24.png',
        32: 'icons/detached-32.png',
      },
    },
  },
  hooks: {
    'build:publicAssets': ({ config }, files) => {
      files.push({ absoluteSrc: `${config.root}/LICENSE`, relativeDest: 'LICENSE' });
    },
  },
});
