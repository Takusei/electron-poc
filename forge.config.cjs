module.exports = {
  packagerConfig: {
    asar: true,
    appBundleId: 'com.figma.mymakefile',
    executableName: 'AI-VDR',
    extraResource: [
      'backend',
    ],
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-dmg',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
    },
    {
      name: '@electron-forge/maker-rpm',
    },
  ],
};
