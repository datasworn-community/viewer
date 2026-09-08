/**
 * The stale-render guard, with the resolution order forced.
 *
 * The race is not hypothetical and not rare -- it is the *first* use. The
 * opening navigation triggers the cold module load of the 0.3 MB schema; a
 * second navigation a moment later hits the cache and finishes first. The
 * slow first render then lands on top of the page the reader is actually
 * looking at.
 *
 * Left to real timing the two continuations resolve in registration order and
 * the bug never shows, so the loader is mocked to hand out one gate per call
 * and they are resolved back to front. That is the whole reason this lives in
 * its own file: the mock has to be in place before `Detail.ts` is imported.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

/** One deferred per `loadSchema()` call, in call order. */
const gates: Array<{ resolve: (v: unknown) => void; promise: Promise<unknown> }> = []

vi.mock('../utils/schema', async () => {
	const actual =
		await vi.importActual<typeof import('../utils/schema')>('../utils/schema')
	return {
		...actual,
		loadSchema: () => {
			let resolve!: (v: unknown) => void
			const promise = new Promise<unknown>((r) => {
				resolve = r
			})
			gates.push({ resolve, promise })
			return promise
		}
	}
})

const { createDetailPanel } = await import('./Detail')
const { state } = await import('../state')
const { loadSchema: realLoadSchema } =
	await vi.importActual<typeof import('../utils/schema')>('../utils/schema')

describe('two schema navigations in flight at once', () => {
	let container: HTMLElement

	beforeEach(async () => {
		gates.length = 0
		state.setRulesets(new Map())
		container = document.createElement('div')
		document.body.replaceChildren(container)
		createDetailPanel(container)
		// Warm the renderer module. Loading it is a macrotask whose scheduling
		// this test cannot control, and leaving it cold made the assertions
		// below pass or fail depending on which turn it landed in.
		await import('../renderers/schema')
	})

	/** Let every already-queued microtask and job run. No timing window. */
	const settle = () => new Promise((r) => setTimeout(r, 0))

	it('drops the abandoned render instead of painting it over the new page', async () => {
		const schema = await realLoadSchema()
		const panel = container.querySelector('.detail-panel') as HTMLElement

		// Park a render on the schema load, then navigate away while it waits.
		state.navigateToId('schema:OracleRollable/table_text', false)
		await vi.waitFor(() => expect(gates.length).toBe(1))
		state.navigateToId('schema:OracleRollable', false)
		await vi.waitFor(() => expect(gates.length).toBe(2))

		// Finish the abandoned one first, alone. Nothing may reach the panel:
		// the reader asked for the union and the arm is no longer their page.
		gates[0].resolve(schema)
		await settle()
		expect(panel.innerHTML).toContain('Loading schema')

		// Then the one they are actually waiting for.
		gates[1].resolve(schema)
		await settle()
		expect(container.querySelector('.detail-header h2')?.textContent).toBe(
			'OracleRollable'
		)
		expect(panel.innerHTML).toContain('schema-variants')
	})
})
