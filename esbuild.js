import esbuild from 'esbuild'

// Custom plugin to handle the # prefixed modules
const resolveVendorModulesPlugin = {
    name: 'resolve-vendor-modules',
    setup(build) {
        build.onResolve({ filter: /^#.*$/ }, args => {
            if (args.path === '#ansi-styles') {
              const relativePath = "node_modules/chalk/source/vendor/ansi-styles/index.js";
              const cwd = process.cwd();
              return {
                path: `${cwd}/${relativePath}`,
              };
            } else if (args.path === '#supports-color') {
              const relativePath = "node_modules/chalk/source/vendor/supports-color/index.js";
              const cwd = process.cwd();
              return {
                path: `${cwd}/${relativePath}`,
              };
            }
        });
    }
};

esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    sourcemap: true,
    target: 'node20',
    platform: 'node',
    format: 'cjs', // CommonJS output
    outfile: 'dist/index.cjs', // Output file is .cjs
    banner: {
        js: '#!/usr/bin/env node',
    },
    plugins: [resolveVendorModulesPlugin],
})
.then(async (result) => {
    console.log('Build complete');
})
.catch(() => process.exit(1));
