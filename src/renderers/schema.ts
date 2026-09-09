/**
 * Minimal rendering for a schema definition.
 *
 * Deliberately plain, and that is the design decision rather than an omission.
 * The panel's shape -- left rail, curated taxonomy, live examples pulled from
 * loaded content -- is still being discussed in
 * datasworn-community/.github#13. Anything opinionated here would be thrown
 * away if it lands differently, so this renders the fields and stops.
 */

import type { SchemaDefinition } from '../utils/schema'
import { escapeHtml } from '../utils/html'

/** Render one definition as a field table. */
export function renderSchemaDefinition(def: SchemaDefinition): string {
	const rows = def.fields
		.map((field) => {
			// A $ref is linked with the same `#schema:` hash the URL decision
			// settled on, which is why it works here with no router: it is one
			// more id in the grammar the app already navigates.
			const type = field.ref
				? `<a href="#schema:${escapeHtml(field.ref)}">${escapeHtml(field.ref)}</a>`
				: escapeHtml(field.type ?? '—')

			const description = field.description
				? escapeHtml(field.description)
				: '<em class="schema-field-nodesc">No description in the schema</em>'

			return `
				<tr>
					<td class="schema-field-name"><code>${escapeHtml(field.name)}</code></td>
					<td class="schema-field-type">${type}</td>
					<td class="schema-field-req">${field.required ? 'required' : 'optional'}</td>
					<td class="schema-field-desc">${description}</td>
				</tr>`
		})
		.join('')

	const description = def.description
		? `<p class="schema-description">${escapeHtml(def.description)}</p>`
		: ''

	// A union carries its fields in its arms, not on itself, so read as a plain
	// object it shows one property and nothing else. These links are the only
	// way to reach the arms without knowing the URL grammar by heart.
	const variants = def.variants.length
		? `
		<p class="schema-variants-label">
			One of, by <code>${escapeHtml(def.discriminator ?? 'type')}</code>:
		</p>
		<ul class="schema-variants">${def.variants
			.map(
				(v) => `
			<li>
				<a href="#schema:${escapeHtml(def.name)}/${escapeHtml(v.value)}">
					<code>${escapeHtml(v.value)}</code></a>
				<span class="schema-variant-type">${escapeHtml(v.typeName)}</span>
			</li>`
			)
			.join('')}</ul>`
		: ''

	return `
		<div class="detail-header">
			<h2>${escapeHtml(def.name)}</h2>
			<span class="detail-type">schema</span>
		</div>
		${description}
		${variants}
		<table class="schema-fields">
			<thead>
				<tr><th>Field</th><th>Type</th><th></th><th>Description</th></tr>
			</thead>
			<tbody>${rows}</tbody>
		</table>`
}
