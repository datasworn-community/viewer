/**
 * Reading the Datasworn JSON schema, for the schema-lookup URLs.
 *
 * The schema ships inside `@datasworn-community/core` as a flat draft-07
 * document: every type is a key under `definitions`, and every `$ref` points
 * back into the same file. So this is a lookup, not a parser -- which is the
 * one part of the schema-explorer proposal that turned out cheaper than the
 * draft assumed rather than dearer.
 *
 * Loaded lazily. It is ~0.3 MB against an 8 MB bundle, and nobody who never
 * opens a `#schema:` URL should pay for it.
 */

/** One field of a definition, flattened for rendering. */
export interface SchemaField {
	name: string
	/** The definition this field points at, when it points at one. */
	ref?: string
	/** The field's own description. Absent for 45% of real fields. */
	description?: string
	required: boolean
	/** The JSON-Schema `type`, when the field has one rather than a `$ref`. */
	type?: string
}

/** One arm of a discriminated union. */
export interface SchemaVariant {
	/** The discriminator value, e.g. `table_text`. */
	value: string
	/** The concrete definition it selects. */
	typeName: string
}

export interface SchemaDefinition {
	name: string
	description?: string
	fields: SchemaField[]
	/** The property that selects a variant, for a union. */
	discriminator?: string
	/** The arms of the union, empty for a plain definition. */
	variants: SchemaVariant[]
}

/** A parsed `schema:` hash. */
export interface SchemaRef {
	typeName: string
	/** The `oracle_type` / `roll_type` value, when one was named. */
	discriminator?: string
}

const SCHEMA_PREFIX = 'schema:'

/**
 * Whether a hash id addresses the schema rather than content.
 *
 * Datasworn ids are already `<type>:<path>`, so `schema:` is one more type in
 * a grammar that exists rather than a second URL scheme beside it. That is the
 * whole reason this needs no router: `main.ts` keeps handing the hash to
 * `navigateToId`, which now branches here first.
 */
export function isSchemaId(id: string): boolean {
	return id.startsWith(SCHEMA_PREFIX) && id.length > SCHEMA_PREFIX.length
}

/**
 * Split `schema:OracleRollable/table_text` into its parts.
 *
 * The second segment is a discriminator, NOT a ruleset -- which is precisely
 * why callers must check `isSchemaId` before `navigateToId`'s content path
 * reads `pathSegments[0]` as one.
 */
export function parseSchemaId(id: string): SchemaRef | null {
	if (!isSchemaId(id)) return null
	const [typeName, discriminator] = id.slice(SCHEMA_PREFIX.length).split('/')
	if (!typeName) return null
	return { typeName, discriminator }
}

/** The definition name a `$ref` points at, or undefined for anything else. */
function refName(node: unknown): string | undefined {
	if (typeof node !== 'object' || node === null) return undefined
	const ref = (node as { $ref?: unknown }).$ref
	if (typeof ref === 'string' && ref.startsWith('#/definitions/'))
		return ref.slice('#/definitions/'.length)
	// Arrays carry the link on `items`, which is how most cross-links are shaped.
	const items = (node as { items?: unknown }).items
	return items === undefined ? undefined : refName(items)
}

/**
 * Read an `allOf` of `if/then` pairs as a discriminated union.
 *
 * 17 of the schema's 258 definitions are shaped this way, `OracleRollable`
 * among them: one own property -- the discriminator -- plus an `allOf` whose
 * entries each test a `const` and point at the concrete type. Read as a plain
 * object such a definition looks like a type with a single field, which is
 * exactly what it looked like until this was measured against the real schema.
 */
function readUnion(node: {
	properties?: Record<string, unknown>
	allOf?: unknown[]
}): { discriminator?: string; variants: SchemaVariant[] } {
	const variants: SchemaVariant[] = []
	let discriminator: string | undefined

	for (const entry of node.allOf ?? []) {
		const arm = entry as {
			if?: { properties?: Record<string, { const?: unknown }> }
			then?: unknown
		}
		const props = arm.if?.properties
		const target = refName(arm.then)
		if (!props || !target) continue
		for (const [prop, test] of Object.entries(props)) {
			if (typeof test?.const !== 'string') continue
			// First property wins. No union in the shipped schema mixes
			// discriminator names across its arms, so this only decides an
			// arbitrary case -- but it decides it the same way every time.
			discriminator ??= prop
			variants.push({ value: test.const, typeName: target })
		}
	}

	return { discriminator, variants }
}

/**
 * Flatten one definition into something renderable.
 *
 * With a `discriminatorValue`, a union resolves to the concrete arm it selects
 * -- that is what the second segment of `#schema:Type/value` is for. A value
 * that matches no arm falls back to the union itself, so a typo in the URL
 * shows the reader which values exist rather than an empty page.
 *
 * Returns `null` for a name the schema does not carry, rather than an empty
 * shell -- a typo in the type name should read as "no such type", not as a
 * type with no fields.
 */
export function describeDefinition(
	schema: unknown,
	typeName: string,
	discriminatorValue?: string
): SchemaDefinition | null {
	const defs = (schema as { definitions?: Record<string, unknown> })?.definitions
	const node = defs?.[typeName]
	if (typeof node !== 'object' || node === null) return null

	const record = node as {
		description?: string
		required?: string[]
		properties?: Record<string, unknown>
		allOf?: unknown[]
	}

	const union = readUnion(record)
	if (discriminatorValue != null && union.variants.length > 0) {
		const arm = union.variants.find((v) => v.value === discriminatorValue)
		// Only recurse on a match; an unknown value falls through to the union.
		if (arm) return describeDefinition(schema, arm.typeName)
	}

	const required = new Set(record.required ?? [])

	const fields: SchemaField[] = Object.entries(record.properties ?? {}).map(
		([name, value]) => {
			const v = (value ?? {}) as { description?: string; type?: string }
			return {
				name,
				ref: refName(value),
				description: v.description,
				type: typeof v.type === 'string' ? v.type : undefined,
				required: required.has(name)
			}
		}
	)

	return {
		name: typeName,
		description: record.description,
		fields,
		discriminator: union.discriminator,
		variants: union.variants
	}
}

let cached: unknown

/** Load the schema once, on first use. */
export async function loadSchema(): Promise<unknown> {
	if (cached === undefined) {
		const mod = await import(
			'@datasworn-community/core/json/datasworn.schema.json'
		)
		cached = (mod as { default?: unknown }).default ?? mod
	}
	return cached
}
