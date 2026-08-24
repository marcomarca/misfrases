import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';

const config: ForgeConfig = {
  outDir: 'release-package',
  packagerConfig: {
    asar: true,
    prune: true,
    name: 'MisFrases',
    executableName: 'mis-frases',
    icon: './src/assets/icon',
    ignore: [
      /^\/src($|\/)/,
      /^\/tests($|\/)/,
      /^\/scripts($|\/)/,
      /^\/release($|\/)/,
      /^\/release-bin($|\/)/,
      /^\/out($|\/)/,
      /^\/\.git($|\/)/,
      /^\/\.agents($|\/)/,
      /^\/\.gemini($|\/)/,
      /tsconfig\.json$/,
      /bun\.lock$/,
      /PLAN\.MD$/,
      /RUN\.MD$/
    ]
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: 'MisFrases',
      setupIcon: './src/assets/icon.ico'
    }),
    new MakerZIP({}, ['win32'])
  ],
  plugins: [
    new AutoUnpackNativesPlugin({})
  ]
};

export default config;
