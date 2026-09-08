/**
 * The one change the `#schema:` URL decision needs in existing code.
 *
 * `navigateToId` assumes every id is a content path: it rejects anything with
 * fewer than two slash-segments and reads the first as a ruleset. So
 * `schema:OracleRollable` is rejected, and `schema:OracleRollable/table_text`
 * would be read as ruleset "OracleRollable". The schema type has to branch
 * before that assumption, not after it.
 */

import { describe, expect, it, beforeEach } from 'vitest'
import { state } from './state'

describe('navigateToId and schema ids', () => {
	// state.ts exports a singleton, not the class. Resetting the rulesets is
	// enough isolation here: every assertion below is about the id branch, and
	// none of them depends on loaded content.
	beforeEach(() => {
		state.setRulesets(new Map())
	})

	it('accepts a bare schema id, which the content path would reject', () => {
		// One segment: content ids need at least two, so without the branch this
		// returns false at the `pathSegments.length < 2` guard.
		expect(state.navigateToId('schema:OracleRollable', false)).toBe(true)
	})

	it('does not read the discriminator as a ruleset', () => {
		// Two segments: the content path would take "OracleRollable" for a
		// ruleset id and then fail to find it.
		expect(state.navigateToId('schema:OracleRollable/table_text', false)).toBe(
			true
		)
	})

	it('records what was selected so a renderer can read it', () => {
		state.navigateToId('schema:Move/action_roll', false)
		expect(state.getState().schemaRef).toEqual({
			typeName: 'Move',
			discriminator: 'action_roll'
		})
	})

	it('leaves the schema selection alone when a content id resolves to nothing', () => {
		// Corrected after the first run asserted the opposite. A navigation that
		// fails changes nothing -- the user is still looking at what they were --
		// so clearing here would be wrong, not merely different.
		state.navigateToId('schema:Move', false)
		expect(state.navigateToId('oracle_rollable:nope/missing', false)).toBe(false)
		expect(state.getState().schemaRef).toEqual({
			typeName: 'Move',
			discriminator: undefined
		})
	})

	it('clears the schema selection once a content id does resolve', () => {
		// findById maps the id type to a top-level key ("oracle_rollable" ->
		// "oracles") and then walks the remaining path segments, so this is the
		// smallest package that resolves.
		state.setRulesets(
			new Map([
				[
					'fixture',
					{
						oracles: { thing: { _id: 'oracle_rollable:fixture/thing' } }
					} as never
				]
			])
		)

		state.navigateToId('schema:Move', false)
		expect(state.navigateToId('oracle_rollable:fixture/thing', false)).toBe(true)
		expect(state.getState().schemaRef).toBeUndefined()
	})

	it('leaves content navigation alone', () => {
		// The guard must not change the answer for ids it does not own.
		expect(state.navigateToId('not-an-id', false)).toBe(false)
		expect(state.navigateToId('oracle_rollable:nope/missing', false)).toBe(false)
	})
})
