import * as esbuild from 'esbuild'

await esbuild.build({
	entryPoints: ['src/index.ts'],
	outdir: 'dist',
	bundle: true,
	platform: 'node',
	target: 'node18',
	format: 'esm',
	packages: 'external',
})
