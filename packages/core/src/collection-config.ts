/**
 * Collection config parse/validate + stage resolution + dry-run mint gate.
 * Pure (no fs). File loading lives in collection-config-fs.ts / drop-node.
 */

import { verifyAllowlistMembership } from './allowlist.js';
import type {
  AllowlistSnapshot,
  CollectionConfig,
  CollectionRarityTier,
  CollectionRoyalty,
  CollectionStage,
  DropEditionInput,
  MintGateResult,
  MintStageKind,
} from './types.js';

const STAGE_KINDS = new Set<MintStageKind>(['allowlist', 'public']);

export class CollectionConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CollectionConfigError';
  }
}

function asString(v: unknown, field: string): string {
  if (typeof v !== 'string' || !v.trim()) {
    throw new CollectionConfigError(`${field} must be a non-empty string`);
  }
  return v.trim();
}

function asOptionalString(v: unknown): string | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'string') throw new CollectionConfigError('expected string');
  return v.trim();
}

function asPositiveInt(v: unknown, field: string): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isInteger(n) || n < 1) {
    throw new CollectionConfigError(`${field} must be a positive integer`);
  }
  return n;
}

function normalizeStageKind(raw: unknown): MintStageKind {
  const k = String(raw ?? '').toLowerCase();
  if (k === 'whitelist') return 'allowlist'; // legacy alias
  if (STAGE_KINDS.has(k as MintStageKind)) return k as MintStageKind;
  throw new CollectionConfigError(`stage.kind must be allowlist|public (got ${String(raw)})`);
}

function parseStage(raw: unknown, index: number): CollectionStage {
  if (!raw || typeof raw !== 'object') {
    throw new CollectionConfigError(`stages[${index}] must be an object`);
  }
  const s = raw as Record<string, unknown>;
  const id = asString(s.id, `stages[${index}].id`);
  const name = asString(s.name, `stages[${index}].name`);
  const kind = normalizeStageKind(s.kind);
  const start = asOptionalString(s.start ?? s.startAt);
  const end = asOptionalString(s.end ?? s.endAt);
  let priceHbar: string | number | undefined;
  if (s.priceHbar !== undefined && s.priceHbar !== null && s.priceHbar !== '') {
    if (typeof s.priceHbar === 'number' || typeof s.priceHbar === 'string') {
      priceHbar = s.priceHbar;
    } else {
      throw new CollectionConfigError(`stages[${index}].priceHbar must be string or number`);
    }
  }
  const snapshotRef = asOptionalString(s.snapshotRef);
  return { id, name, kind, start, end, priceHbar, snapshotRef };
}

function parseTier(raw: unknown, index: number): CollectionRarityTier {
  if (!raw || typeof raw !== 'object') {
    throw new CollectionConfigError(`tiers[${index}] must be an object`);
  }
  const t = raw as Record<string, unknown>;
  return {
    key: asString(t.key ?? t.name, `tiers[${index}].key`),
    name: asString(t.name ?? t.key, `tiers[${index}].name`),
    count: asPositiveInt(t.count, `tiers[${index}].count`),
  };
}

function parseRoyalty(raw: unknown): CollectionRoyalty | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object') throw new CollectionConfigError('royalty must be an object');
  const r = raw as Record<string, unknown>;
  const out: CollectionRoyalty = {};
  if (r.percent !== undefined) {
    const p = Number(r.percent);
    if (!Number.isFinite(p) || p < 0 || p > 100) {
      throw new CollectionConfigError('royalty.percent must be 0..100');
    }
    out.percent = p;
  }
  if (r.collectorAccount !== undefined) {
    out.collectorAccount = asString(r.collectorAccount, 'royalty.collectorAccount');
  }
  return out;
}

function parseAttributes(
  raw: unknown,
): Array<{ trait_type: string; value: string | number }> | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw)) throw new CollectionConfigError('attributes must be an array');
  return raw.map((a, i) => {
    if (!a || typeof a !== 'object') throw new CollectionConfigError(`attributes[${i}] invalid`);
    const o = a as Record<string, unknown>;
    const trait_type = asString(o.trait_type ?? o.traitType, `attributes[${i}].trait_type`);
    const value = o.value;
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new CollectionConfigError(`attributes[${i}].value must be string or number`);
    }
    return { trait_type, value };
  });
}

/**
 * Parse + normalize unknown JSON into a CollectionConfig.
 * Accepts maxEdition and/or maxSupply (both set to the same positive int).
 * Accepts stage.kind "whitelist" as alias for "allowlist".
 */
export function parseCollectionConfig(raw: unknown): CollectionConfig {
  if (!raw || typeof raw !== 'object') {
    throw new CollectionConfigError('collection config must be an object');
  }
  const o = raw as Record<string, unknown>;

  const name = asString(o.name, 'name');
  const symbol = asString(o.symbol, 'symbol');
  const creator = asString(o.creator, 'creator');
  const description = asOptionalString(o.description);

  let maxEdition: number;
  if (o.maxEdition !== undefined) {
    maxEdition = asPositiveInt(o.maxEdition, 'maxEdition');
  } else if (o.maxSupply !== undefined) {
    maxEdition = asPositiveInt(o.maxSupply, 'maxSupply');
  } else if (o.supply !== undefined) {
    maxEdition = asPositiveInt(o.supply, 'supply');
  } else {
    throw new CollectionConfigError('maxEdition (or maxSupply/supply) is required');
  }
  const maxSupply =
    o.maxSupply !== undefined ? asPositiveInt(o.maxSupply, 'maxSupply') : maxEdition;
  if (maxSupply !== maxEdition) {
    throw new CollectionConfigError('maxSupply and maxEdition must match when both set');
  }

  const collectionId =
    asOptionalString(o.collectionId) ??
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  const tiersRaw = o.tiers;
  if (!Array.isArray(tiersRaw) || tiersRaw.length === 0) {
    throw new CollectionConfigError('tiers must be a non-empty array');
  }
  const tiers = tiersRaw.map(parseTier);

  const stagesRaw = o.stages;
  if (!Array.isArray(stagesRaw) || stagesRaw.length === 0) {
    throw new CollectionConfigError('stages must be a non-empty array');
  }
  const stages = stagesRaw.map(parseStage);

  const config: CollectionConfig = {
    collectionId,
    name,
    symbol,
    creator,
    description,
    maxEdition,
    maxSupply,
    royalty: parseRoyalty(o.royalty),
    hrlTopic: asOptionalString(o.hrlTopic),
    nameTemplate: asOptionalString(o.nameTemplate),
    tiers,
    attributes: parseAttributes(o.attributes),
    stages,
    allowlistSnapshotRef: asOptionalString(o.allowlistSnapshotRef),
    allowlistSnapshotHash: asOptionalString(o.allowlistSnapshotHash),
  };

  validateCollectionConfig(config);
  return config;
}

/** Validate stage order / uniqueness and tier counts vs supply. */
export function validateCollectionConfig(config: CollectionConfig): void {
  const ids = new Set<string>();
  for (let i = 0; i < config.stages.length; i++) {
    const s = config.stages[i]!;
    if (ids.has(s.id)) {
      throw new CollectionConfigError(`duplicate stage id: ${s.id}`);
    }
    ids.add(s.id);
    if (s.start && s.end) {
      const a = Date.parse(s.start);
      const b = Date.parse(s.end);
      if (Number.isNaN(a) || Number.isNaN(b)) {
        throw new CollectionConfigError(`stage ${s.id}: start/end must be ISO datetimes`);
      }
      if (a >= b) {
        throw new CollectionConfigError(`stage ${s.id}: start must be before end`);
      }
    }
    if (s.kind === 'allowlist') {
      const ref = s.snapshotRef ?? config.allowlistSnapshotRef;
      if (!ref && !config.allowlistSnapshotHash) {
        // Soft requirement: warn via error only when neither ref nor hash — allow
        // in-memory snapshot binding at mint-gate time.
      }
    }
  }

  // Optional chronological order check when all stages have start
  const withStart = config.stages.filter((s) => s.start);
  if (withStart.length === config.stages.length && config.stages.length > 1) {
    for (let i = 1; i < config.stages.length; i++) {
      const prev = Date.parse(config.stages[i - 1]!.start!);
      const cur = Date.parse(config.stages[i]!.start!);
      if (cur < prev) {
        throw new CollectionConfigError(
          `stages must be ordered by start time; ${config.stages[i]!.id} starts before ${config.stages[i - 1]!.id}`,
        );
      }
    }
  }

  const tierSum = config.tiers.reduce((acc, t) => acc + t.count, 0);
  if (tierSum !== config.maxEdition) {
    throw new CollectionConfigError(
      `tier counts sum to ${tierSum} but maxEdition is ${config.maxEdition}`,
    );
  }

  const tierKeys = new Set<string>();
  for (const t of config.tiers) {
    if (tierKeys.has(t.key)) {
      throw new CollectionConfigError(`duplicate tier key: ${t.key}`);
    }
    tierKeys.add(t.key);
  }
}

function toMs(now?: string | number | Date): number {
  if (now === undefined) return Date.now();
  if (now instanceof Date) return now.getTime();
  if (typeof now === 'number') return now;
  const t = Date.parse(now);
  if (Number.isNaN(t)) throw new CollectionConfigError(`invalid now timestamp: ${now}`);
  return t;
}

/** Whether a stage window contains `now` (open bounds = always in range for that side). */
export function isStageActiveAt(stage: CollectionStage, now?: string | number | Date): boolean {
  const t = toMs(now);
  if (stage.start) {
    const a = Date.parse(stage.start);
    if (!Number.isNaN(a) && t < a) return false;
  }
  if (stage.end) {
    const b = Date.parse(stage.end);
    if (!Number.isNaN(b) && t >= b) return false;
  }
  return true;
}

/**
 * Resolve which stage is "active" for dry-run.
 * - If `stageId` is set (manual selector), return that stage (must exist).
 * - Else pick the first stage whose window contains `now`.
 * - Else fall back to the first stage.
 */
export function resolveActiveStage(
  stages: CollectionStage[],
  opts?: { stageId?: string; now?: string | number | Date },
): CollectionStage {
  if (!stages.length) throw new CollectionConfigError('no stages');
  if (opts?.stageId) {
    const found = stages.find((s) => s.id === opts.stageId);
    if (!found) throw new CollectionConfigError(`unknown stage id: ${opts.stageId}`);
    return found;
  }
  const now = opts?.now;
  if (now !== undefined) {
    const hit = stages.find((s) => isStageActiveAt(s, now));
    if (hit) return hit;
  }
  return stages[0]!;
}

/**
 * Dry-run mint gate: allowlist stage requires membership; public allows any valid account.
 */
export function checkMintGate(input: {
  minterAccount: string;
  stageId?: string;
  config: CollectionConfig;
  snapshot?: AllowlistSnapshot;
  now?: string | number | Date;
}): MintGateResult {
  const stage = resolveActiveStage(input.config.stages, {
    stageId: input.stageId,
    now: input.now,
  });
  const activeByTime = isStageActiveAt(stage, input.now ?? Date.now());
  const account = input.minterAccount.trim();

  if (!/^0\.0\.\d+$/.test(account)) {
    return {
      allowed: false,
      reason: `invalid minter account: ${account}`,
      stage,
      activeByTime,
    };
  }

  // Manual stageId = evaluate that stage's rules regardless of window.
  // activeByTime still reports whether mock `now` falls in the stage window.

  if (stage.kind === 'public') {
    return {
      allowed: true,
      reason: `public stage ${stage.id} — any account may mint`,
      stage,
      activeByTime,
    };
  }

  // allowlist
  if (!input.snapshot) {
    return {
      allowed: false,
      reason: `allowlist stage ${stage.id} requires a snapshot`,
      stage,
      activeByTime,
    };
  }

  if (
    input.config.allowlistSnapshotHash &&
    input.snapshot.snapshotHash !== input.config.allowlistSnapshotHash
  ) {
    return {
      allowed: false,
      reason: 'snapshot hash does not match collection allowlistSnapshotHash',
      stage,
      activeByTime,
    };
  }

  const member = verifyAllowlistMembership(input.snapshot, account);
  if (!member) {
    return {
      allowed: false,
      reason: `account ${account} is not on the allowlist for stage ${stage.id}`,
      stage,
      activeByTime,
    };
  }

  return {
    allowed: true,
    reason: `allowlist stage ${stage.id} — ${account} is a member`,
    stage,
    activeByTime,
  };
}

/**
 * Expand rarity tiers into DropEditionInput skeletons (no image bytes).
 * Caller / buildDropFromCollectionConfig attaches images.
 */
export function editionPlanFromCollection(
  config: CollectionConfig,
): Array<{ edition: number; rarity: string; tierKey: string }> {
  validateCollectionConfig(config);
  const plan: Array<{ edition: number; rarity: string; tierKey: string }> = [];
  let n = 1;
  for (const tier of config.tiers) {
    for (let i = 0; i < tier.count; i++) {
      plan.push({ edition: n, rarity: tier.name, tierKey: tier.key });
      n += 1;
    }
  }
  return plan;
}

/** Build DropEditionInput[] with a caller-provided image factory. */
export function editionsFromCollectionConfig(
  config: CollectionConfig,
  imageFor: (edition: number, rarity: string, tierKey: string) => DropEditionInput['image'],
): DropEditionInput[] {
  return editionPlanFromCollection(config).map((p) => ({
    edition: p.edition,
    rarity: p.rarity,
    image: imageFor(p.edition, p.rarity, p.tierKey),
  }));
}

/** Snapshot ref preferred for a stage (stage override → collection default). */
export function snapshotRefForStage(
  config: CollectionConfig,
  stage: CollectionStage,
): string | undefined {
  return stage.snapshotRef ?? config.allowlistSnapshotRef;
}
