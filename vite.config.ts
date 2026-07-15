import { defineConfig } from 'vite'

// Use `/viewer/` base path for the GitHub Pages deploy under the
// datasworn-community org; `./` for local dev/preview so everything works
// under any nesting.
const isGitHubPages = process.env.GITHUB_PAGES === 'true'

export default defineConfig({
	root: '.',
	base: isGitHubPages ? '/viewer/' : './',
	server: {
		port: 3000,
		open: true
	},
	build: {
		outDir: 'dist',
		emptyOutDir: true
	}
})
