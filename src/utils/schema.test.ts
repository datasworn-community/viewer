/**
 * Tests for the schema lookup.
 *
 * Scope note: this covers the URL decision from the schema-explorer proposal
 * (datasworn-community/.github#13) and nothing beyond it. There is no panel,
 * no left rail and no example finder here -- those depend on the shape of the
 * proposal, which is still under discussion, and would be thrown away if it
 * lands differently.
 */

import { describe, expect, it } from 'vitest'
import { isSchemaId, parseSchemaId, describeDefinition } from './schema'

describe('parseSchemaId', () => {
	it('reads a bare type name', () => {
		expect(parseSchemaId('schema:OracleRollable')).toEqual({
			typeName: 'OracleRollable',
			discriminator: undefined
		})
	})

	it('reads a type name with a discriminator', () => {
		// The second segment is the discriminator, NOT a ruleset. navigateToId
		// reads pathSegments[0] as the ruleset for content ids, which is exactly
		// why the schema type has to branch before that assumption.
		expect(parseSchemaId('schema:OracleRollable/table_text')).toEqual({
			typeName: 'OracleRollable',
			discriminator: 'table_text'
		})
	})

	it('rejects a content id', () => {
		expect(parseSchemaId('oracle_rollable:starforged/core/action')).toBeNull()
	})

	it('rejects an id with no type name after the colon', () => {
		expect(parseSchemaId('schema:')).toBeNull()
	})
})

describe('isSchemaId', () => {
	it('separates schema ids from content ids', () => {
		// The whole point of the `#schema:` choice: one more type in the grammar
		// the hash already uses, rather than a second URL scheme beside it.
		expect(isSchemaId('schema:Move')).toBe(true)
		expect(isSchemaId('schema:Move/action_roll')).toBe(true)
		expect(isSchemaId('oracle_rollable:starforged/core/action')).toBe(false)
		expect(isSchemaId('move:classic/suffer/endure_harm')).toBe(false)
		expect(isSchemaId('')).toBe(false)
		// The prefix alone names no type. Caught by mutation: dropping the
		// length check let this through, and every downstream assertion still
		// passed because parseSchemaId rejects it a second time. isSchemaId is
		// exported on its own, so it has to be right on its own.
		expect(isSchemaId('schema:')).toBe(false)
	})
})

describe('describeDefinition', () => {
	const schema = {
		definitions: {
			Widget: {
				description: 'A widget.',
				required: ['_id', 'name'],
				properties: {
					_id: { $ref: '#/definitions/WidgetId', description: 'The id.' },
					name: { type: 'string', description: 'The label.' },
					count: { type: 'integer' },
					tags: { type: 'array', items: { $ref: '#/definitions/Tag' } }
				}
			},
			WidgetId: { type: 'string', description: 'A widget id.' }
		}
	}

	it('returns the definition description and its fields', () => {
		const d = describeDefinition(schema, 'Widget')
		expect(d?.description).toBe('A widget.')
		expect(d?.fields.map((f) => f.name)).toEqual([
			'_id',
			'name',
			'count',
			'tags'
		])
	})

	it('marks required and optional fields apart', () => {
		const d = describeDefinition(schema, 'Widget')
		expect(d?.fields.find((f) => f.name === '_id')?.required).toBe(true)
		expect(d?.fields.find((f) => f.name === 'count')?.required).toBe(false)
	})

	it('names the referenced type so a field can be linked', () => {
		const d = describeDefinition(schema, 'Widget')
		expect(d?.fields.find((f) => f.name === '_id')?.ref).toBe('WidgetId')
		// Through an array's items, which is how most cross-links are shaped.
		expect(d?.fields.find((f) => f.name === 'tags')?.ref).toBe('Tag')
		expect(d?.fields.find((f) => f.name === 'name')?.ref).toBeUndefined()
	})

	it('reports a field with no description rather than inventing one', () => {
		// 45% of field slots in the real schema have no description of their own.
		// Rendering has to cope with that, so it must be visible here.
		const d = describeDefinition(schema, 'Widget')
		expect(d?.fields.find((f) => f.name === 'count')?.description).toBeUndefined()
	})

	it('exposes the variants of a discriminated union', () => {
		// 17 of the schema's 258 definitions are shaped this way, OracleRollable
		// among them: one own property (the discriminator) plus an allOf of
		// if/then pairs pointing at the concrete types. Read as a plain object
		// it looks like a type with a single field, which is what the first
		// run against the real schema showed.
		const union = {
			definitions: {
				Thing: {
					description: 'A thing.',
					properties: { thing_type: { type: 'string' } },
					allOf: [
						{
							if: { properties: { thing_type: { const: 'red' } } },
							then: { $ref: '#/definitions/RedThing' }
						},
						{
							if: { properties: { thing_type: { const: 'blue' } } },
							then: { $ref: '#/definitions/BlueThing' }
						}
					]
				},
				RedThing: {
					required: ['shade'],
					properties: { shade: { type: 'string', description: 'How red.' } }
				}
			}
		}

		const d = describeDefinition(union, 'Thing')
		expect(d?.discriminator).toBe('thing_type')
		expect(d?.variants).toEqual([
			{ value: 'red', typeName: 'RedThing' },
			{ value: 'blue', typeName: 'BlueThing' }
		])
	})

	it('ignores an allOf arm whose condition is not a const test', () => {
		// Neither guard in readUnion is exercised by the shipped schema: it has
		// no non-string const and no if-property without one. They are here so
		// a future arm shaped differently drops out instead of becoming a
		// variant with an undefined value -- which would render as a dead link.
		const odd = {
			definitions: {
				Thing: {
					properties: { thing_type: { type: 'string' } },
					allOf: [
						{ if: { properties: { extra: { type: 'object' } } }, then: { $ref: '#/definitions/Extra' } },
						{ if: { properties: { thing_type: { const: 7 } } }, then: { $ref: '#/definitions/Seven' } },
						{ if: { properties: { thing_type: { const: 'red' } } }, then: { $ref: '#/definitions/RedThing' } }
					]
				}
			}
		}

		const d = describeDefinition(odd, 'Thing')
		expect(d?.variants).toEqual([{ value: 'red', typeName: 'RedThing' }])
		expect(d?.discriminator).toBe('thing_type')
	})

	it('keeps the first discriminator when arms disagree about it', () => {
		// No shipped union mixes names, so this pins an arbitrary choice rather
		// than a correct one. It is worth pinning anyway: without it the name
		// shown to the reader depends on definition order in the schema file.
		const mixed = {
			definitions: {
				Thing: {
					allOf: [
						{ if: { properties: { a_type: { const: 'red' } } }, then: { $ref: '#/definitions/Red' } },
						{ if: { properties: { b_type: { const: 'blue' } } }, then: { $ref: '#/definitions/Blue' } }
					]
				}
			}
		}

		const d = describeDefinition(mixed, 'Thing')
		expect(d?.discriminator).toBe('a_type')
		expect(d?.variants).toHaveLength(2)
	})

	it('resolves a variant to the concrete type when one is named', () => {
		// This is what the discriminator in `#schema:Thing/red` is for. Without
		// it the second URL segment would be decoration.
		const union = {
			definitions: {
				Thing: {
					properties: { thing_type: {} },
					allOf: [
						{
							if: { properties: { thing_type: { const: 'red' } } },
							then: { $ref: '#/definitions/RedThing' }
						}
					]
				},
				RedThing: {
					required: ['shade'],
					properties: { shade: { type: 'string', description: 'How red.' } }
				}
			}
		}

		const d = describeDefinition(union, 'Thing', 'red')
		expect(d?.name).toBe('RedThing')
		expect(d?.fields.map((f) => f.name)).toEqual(['shade'])
	})

	it('falls back to the union when the discriminator matches nothing', () => {
		const union = {
			definitions: {
				Thing: {
					properties: { thing_type: {} },
					allOf: [
						{
							if: { properties: { thing_type: { const: 'red' } } },
							then: { $ref: '#/definitions/RedThing' }
						}
					]
				},
				RedThing: { properties: {} }
			}
		}
		// A typo in the URL should show the union and its variants, which tells
		// the reader what the valid values are -- not an empty page.
		expect(describeDefinition(union, 'Thing', 'chartreuse')?.name).toBe('Thing')
	})

	it('returns null for a type the schema does not have', () => {
		expect(describeDefinition(schema, 'NoSuchType')).toBeNull()
	})
})
