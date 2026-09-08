/**
 * The minimal schema view.
 *
 * Deliberately plain. The panel's shape -- left rail, curated taxonomy, live
 * examples -- is still under discussion in
 * datasworn-community/.github#13, and anything opinionated here would be
 * thrown away if it lands differently. This renders the fields and stops.
 */

import { describe, expect, it } from 'vitest'
import { renderSchemaDefinition } from './schema'

const widget = {
	name: 'Widget',
	description: 'A widget.',
	fields: [
		{ name: '_id', ref: 'WidgetId', description: 'The id.', required: true },
		{ name: 'name', type: 'string', description: 'The label.', required: true },
		{ name: 'count', type: 'integer', required: false }
	],
	variants: []
}

describe('renderSchemaDefinition', () => {
	it('names the type and shows its description', () => {
		const html = renderSchemaDefinition(widget)
		expect(html).toContain('Widget')
		expect(html).toContain('A widget.')
	})

	it('lists every field', () => {
		const html = renderSchemaDefinition(widget)
		for (const f of ['_id', 'name', 'count']) expect(html).toContain(f)
	})

	it('marks optional fields, so required is not guessed from position', () => {
		const html = renderSchemaDefinition(widget)
		expect(html).toContain('optional')
	})

	it('links a $ref field to its own schema url', () => {
		// The cross-link is the reason `#schema:` had to be a real hash id
		// rather than a query parameter: it has to be linkable from inside
		// rendered HTML with no router involved.
		expect(renderSchemaDefinition(widget)).toContain('#schema:WidgetId')
	})

	it('says a description is missing rather than rendering an empty cell', () => {
		// 45% of real field slots have none. Silence would read as "no docs
		// needed here", which is the opposite of true.
		expect(renderSchemaDefinition(widget)).toContain('No description')
	})

	it('links the arms of a union, which are otherwise unreachable', () => {
		// Read as a plain object a union shows one field -- the discriminator --
		// and nothing else. Without these links `#schema:OracleRollable` is a
		// dead end: the reader can see that six variants exist only by knowing
		// the URL grammar and typing one.
		const union = {
			name: 'Thing',
			fields: [{ name: 'thing_type', type: 'string', required: true }],
			discriminator: 'thing_type',
			variants: [
				{ value: 'red', typeName: 'RedThing' },
				{ value: 'blue', typeName: 'BlueThing' }
			]
		}

		const html = renderSchemaDefinition(union)
		expect(html).toContain('#schema:Thing/red')
		expect(html).toContain('#schema:Thing/blue')
		// The discriminator is named, so the link list reads as "pick a value
		// for thing_type" rather than as an unexplained set of type names.
		expect(html).toContain('thing_type')
	})

	it('escapes a variant value rather than trusting the schema', () => {
		const nasty = {
			name: '<b>T</b>',
			fields: [],
			discriminator: '<i>d</i>',
			variants: [{ value: '"><script>', typeName: '<u>X</u>' }]
		}
		const html = renderSchemaDefinition(nasty)
		expect(html).not.toContain('<script>')
		expect(html).not.toContain('<u>X</u>')
	})

	it('escapes field text rather than trusting the schema', () => {
		const nasty = {
			name: 'X',
			fields: [
				{ name: '<img src=x onerror=alert(1)>', required: false, type: 'string' }
			],
			variants: []
		}
		const html = renderSchemaDefinition(nasty)
		expect(html).not.toContain('<img src=x')
		expect(html).toContain('&lt;img')
	})
})
