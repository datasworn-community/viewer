/**
 * The wiring between a `#schema:` url and the rendered panel.
 *
 * This is the one file of the schema slice with no test of its own, and it is
 * where the discriminator went missing: the state carried `table_text`, the
 * renderer could show it, and the panel dropped it in between. Neither the
 * unit tests nor the run against the real schema could see that -- both call
 * `describeDefinition` directly, which is precisely the call this file makes
 * wrong.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { createDetailPanel } from './Detail'
import { state } from '../state'

/** The panel renders after an await, so assertions have to wait for it. */
async function panelHtml(container: HTMLElement): Promise<string> {
	const panel = container.querySelector('.detail-panel') as HTMLElement
	for (let i = 0; i < 50; i++) {
		if (!panel.innerHTML.includes('Loading schema')) return panel.innerHTML
		await new Promise((r) => setTimeout(r, 20))
	}
	return panel.innerHTML
}

/**
 * The name in the heading -- not `toContain(name)`.
 *
 * A union lists its arms by type name, so `toContain('OracleTableText')` is
 * true of the union page too. That assertion passed against the bug it was
 * written to catch.
 */
function heading(container: HTMLElement): string | undefined {
	return container.querySelector('.detail-header h2')?.textContent ?? undefined
}

describe('the detail panel and schema urls', () => {
	let container: HTMLElement

	beforeEach(() => {
		state.setRulesets(new Map())
		container = document.createElement('div')
		document.body.replaceChildren(container)
		createDetailPanel(container)
	})

	it('renders the union for a bare type', async () => {
		state.navigateToId('schema:OracleRollable', false)
		const html = await panelHtml(container)
		expect(heading(container)).toBe('OracleRollable')
		expect(html).toContain('#schema:OracleRollable/table_text')
	})

	it('renders the concrete arm when the url names a discriminator', async () => {
		// Without forwarding `schemaRef.discriminator` this still passes the
		// checks a reader would think to write -- the panel shows a schema type
		// and does not error. It just shows the wrong one.
		state.navigateToId('schema:OracleRollable/table_text', false)
		const html = await panelHtml(container)
		expect(heading(container)).toBe('OracleTableText')
		// The arm is a concrete type, so it has no variant list of its own.
		expect(html).not.toContain('schema-variants')
		expect(html).toContain('rows')
	})

	it('says so when the type does not exist', async () => {
		state.navigateToId('schema:NoSuchType', false)
		const html = await panelHtml(container)
		expect(html).toContain('No schema type named')
	})
})
