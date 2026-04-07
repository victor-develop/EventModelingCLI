import { Node, NodeKind } from '../domain/types';

const RESERVED_WORDS = ['new', 'edit', 'delete', 'list', 'show', 'diff', 'submit', 'draft', 'project', 'init', 'open', 'ctx'];

export interface LintError {
  code: string;
  message: string;
  severity: 'error' | 'warning';
  details: Record<string, unknown>;
}

export function lintCanonicalId(canonicalId: string, kind: NodeKind, existingIds: Set<string>): LintError[] {
  const errors: LintError[] = [];

  if (!/^[a-z][a-z0-9.-]*$/.test(canonicalId)) {
    errors.push({
      code: 'LINT-001',
      message: `canonicalId "${canonicalId}" violates character rules: lowercase, a-z/0-9/hyphen/dot only`,
      severity: 'error',
      details: { canonicalId },
    });
  }

  if (existingIds.has(canonicalId)) {
    errors.push({
      code: 'LINT-002',
      message: `canonicalId "${canonicalId}" is not unique within project`,
      severity: 'error',
      details: { canonicalId },
    });
  }

  const segments = canonicalId.split('.');
  for (const seg of segments) {
    if (RESERVED_WORDS.includes(seg)) {
      errors.push({
        code: 'LINT-003',
        message: `Segment "${seg}" in "${canonicalId}" is a reserved word`,
        severity: 'error',
        details: { canonicalId, segment: seg },
      });
    }
  }

  switch (kind) {
    case 'cmd': {
      const cmdPattern = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*\.cmd\.[a-z][a-z0-9-]*-[a-z][a-z0-9-]*$/;
      if (!cmdPattern.test(canonicalId)) {
        errors.push({
          code: 'LINT-CMD-001',
          message: `cmd canonicalId must match <domainPath>.cmd.<verb-object>`,
          severity: 'error',
          details: { canonicalId },
        });
      }
      break;
    }
    case 'evt': {
      const evtPattern = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*\.evt\.[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/;
      if (!evtPattern.test(canonicalId)) {
        errors.push({
          code: 'LINT-EVT-001',
          message: `evt canonicalId must match <domainPath>.evt.<noun>.<state>`,
          severity: 'error',
          details: { canonicalId },
        });
      }
      const vagueStates = ['updated', 'changed', 'done', 'modified', 'processed'];
      const parts = canonicalId.split('.');
      const statePart = parts[parts.length - 1];
      if (statePart && vagueStates.includes(statePart)) {
        errors.push({
          code: 'LINT-EVT-002',
          message: `Event state "${statePart}" is too vague`,
          severity: 'warning',
          details: { canonicalId, state: statePart },
        });
      }
      break;
    }
    case 'viewModel': {
      const viewPattern = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*\.view\.[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/;
      if (!viewPattern.test(canonicalId)) {
        errors.push({
          code: 'LINT-VIEW-001',
          message: `view canonicalId must match <domainPath>.view.<noun>.<projection>`,
          severity: 'error',
          details: { canonicalId },
        });
      }
      break;
    }
    case 'proc': {
      const procPattern = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*\.proc\.[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/;
      if (!procPattern.test(canonicalId)) {
        errors.push({
          code: 'LINT-PROC-001',
          message: `proc canonicalId must match <domainPath>.proc.<noun>.<verb>`,
          severity: 'error',
          details: { canonicalId },
        });
      }
      break;
    }
    case 'trigger': {
      const triggerPattern = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*\.trigger\.[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/;
      if (!triggerPattern.test(canonicalId)) {
        errors.push({
          code: 'LINT-TRIGGER-001',
          message: `trigger canonicalId must match <domainPath>.trigger.<source>.<name>`,
          severity: 'error',
          details: { canonicalId },
        });
      }
      break;
    }
  }

  return errors;
}

export function lintAll(nodes: Node[]): LintError[] {
  const allErrors: LintError[] = [];
  const existingIds = new Set<string>();
  for (const node of nodes) {
    existingIds.add(node.canonicalId);
  }
  const idSet = new Set<string>();
  for (const node of nodes) {
    const errs = lintCanonicalId(node.canonicalId, node.kind, idSet);
    allErrors.push(...errs);
    idSet.add(node.canonicalId);
  }
  return allErrors;
}
