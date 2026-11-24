module.exports = {
  packagerConfig: {
    name: "Autoservis Roháček",
    executableName: "autoservis-rohacek",
    asar: true,
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: "autoservis_rohacek",
        setupExe: "AutoservisRohacek-Setup.exe",
        title: "Autoservis Roháček"
      },
    }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        // Hlavní proces
        build: [
          {
            entry: 'main.js',
            config: 'vite.config.ts',
          },
        ],
        // Renderer (React)
        renderer: [
          {
            name: 'main_window',
            config: 'vite.config.ts',
          },
        ],
      },
    },
  ],
};
