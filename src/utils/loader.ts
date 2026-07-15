import type { Datasworn } from '@datasworn-community/core'

export type RulesPackage = Datasworn.RulesPackage

interface RulesetDef {
	/** Stable id used in URLs and state — matches the ruleset's `_id`. */
	id: string
	/** Dynamic import of the published npm package's default export. */
	load: () => Promise<{ default: RulesPackage }>
}

/**
 * All rulesets/expansions the viewer knows about. Each entry corresponds to a
 * published `@datasworn-community/*` package; dynamic imports keep the initial
 * bundle small and let us degrade gracefully if a package is missing.
 *
 * Add a new entry when a new content package publishes to npm.
 */
const RULESETS: RulesetDef[] = [
	{ id: 'classic', load: () => import('@datasworn-community/ironsworn-classic') },
	{
		id: 'delve',
		load: () => import('@datasworn-community/ironsworn-classic-delve')
	},
	{
		id: 'lodestar',
		load: () => import('@datasworn-community/ironsworn-classic-lodestar')
	},
	{ id: 'starforged', load: () => import('@datasworn-community/starforged') },
	{
		id: 'sundered_isles',
		load: () => import('@datasworn-community/sundered-isles')
	},
	{ id: 'starsmith', load: () => import('@datasworn-community/starsmith') },
	{ id: 'ironsmith', load: () => import('@datasworn-community/ironsmith') }
	// TODO: add `fe_runners` and `ancient_wonders` when they publish to npm.
]

export async function loadRuleset(id: string): Promise<RulesPackage> {
	const def = RULESETS.find((r) => r.id === id)
	if (!def) throw new Error(`Unknown ruleset id: ${id}`)
	const mod = await def.load()
	return mod.default
}

export async function loadAllRulesets(): Promise<Map<string, RulesPackage>> {
	const results = new Map<string, RulesPackage>()

	await Promise.all(
		RULESETS.map(async ({ id, load }) => {
			try {
				const mod = await load()
				results.set(id, mod.default)
			} catch (e) {
				console.warn(`Could not load ruleset: ${id}`, e)
			}
		})
	)

	return results
}

export function getRulesetDisplayName(pkg: RulesPackage): string {
	return pkg.title
}
