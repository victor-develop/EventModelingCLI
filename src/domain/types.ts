export type NodeKind =
  | 'story.epic' | 'story.story' | 'story.scenario'
  | 'role'
  | 'ui.app' | 'ui.area' | 'ui.screen' | 'ui.section' | 'ui.component'
  | 'cmd' | 'evt' | 'viewModel'
  | 'proc' | 'trigger';

export type EdgeType =
  | 'parentOf'
  | 'storyOwnsCommand'
  | 'roleUsesUIToIssueCommand'
  | 'processorOrTriggerIssuesCommand'
  | 'commandCausesEvent'
  | 'eventRefreshesViewModel'
  | 'eventUpdatesProcessor'
  | 'uiOrProcessorConsumesViewModel';

export interface Node {
  id: string;
  projectId: string;
  kind: NodeKind;
  canonicalId: string;
  displayName: string;
  description?: string;
  tags: string[];
  domains: string[];
  owner?: string;
  role?: string;
  parentCanonicalId?: string;
}

export interface Edge {
  id: string;
  projectId: string;
  type: EdgeType;
  fromNodeId: string;
  toNodeId: string;
  viaNodeId?: string;
  meta?: Record<string, unknown>;
}

export interface ViewModelFieldSource {
  eventNodeId: string;
  eventFieldPath: string;
}

export interface ViewModelField {
  fieldId: string;
  name: string;
  type: string;
  nullable: boolean;
  description?: string;
  source: ViewModelFieldSource;
}

export interface CommandField {
  fieldId: string;
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface EventField {
  fieldId: string;
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface CommandSchema {
  commandNodeId: string;
  version: number;
  input: { fields: CommandField[] };
}

export interface EventSchema {
  eventNodeId: string;
  version: number;
  payload: { fields: EventField[] };
}

export interface ViewModelSchema {
  viewModelNodeId: string;
  fields: ViewModelField[];
}

export interface ProjectManifest {
  id: string;
  name: string;
  description?: string;
  headRevisionId: string | null;
  nodeCounter: number;
  edgeCounter: number;
  revisionCounter: number;
  draftCounter: number;
  proposalCounter: number;
}

export interface Revision {
  id: string;
  projectId: string;
  parentRevisionId: string | null;
  message: string;
  createdAt: string;
  author: string;
}

export interface DraftOp {
  op: string;
  entityType: 'node' | 'edge' | 'schema';
  entityId: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface ProposalOverride {
  type: 'include-path' | 'exclude-path';
  path: string[];
  reason: string;
  createdBy: string;
  createdAt: string;
}

export interface Proposal {
  id: string;
  storyId: string;
  mode: 'core' | 'full';
  candidateRootCommandIds: string[];
  resolvedSubgraph: {
    coreNodes: string[];
    interfaceNodes: string[];
    boundaryNodes: string[];
  };
  overrides: ProposalOverride[];
  previousProposalId?: string;
}

export interface Draft {
  id: string;
  projectId: string;
  baseRevisionId: string;
  status: 'open' | 'submitted' | 'abandoned';
  message: string;
  ops: DraftOp[];
  proposals: Proposal[];
}

export interface ContextState {
  activeProjectId?: string;
  activeProjectDir?: string;
  activeDraftId?: string;
  checkedOutRevisionId?: string;
}

export interface CLIResult {
  ok: boolean;
  command: string;
  projectId?: string;
  draftId?: string;
  revisionId?: string;
  data: Record<string, unknown>;
  warnings: string[];
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export function okResult(
  command: string,
  data: Record<string, unknown>,
  opts?: { projectId?: string; draftId?: string; revisionId?: string }
): CLIResult {
  return {
    ok: true,
    command,
    projectId: opts?.projectId,
    draftId: opts?.draftId,
    revisionId: opts?.revisionId,
    data,
    warnings: [],
  };
}

export function errResult(
  command: string,
  code: string,
  message: string,
  opts?: { projectId?: string; draftId?: string; details?: Record<string, unknown> }
): CLIResult {
  return {
    ok: false,
    command,
    projectId: opts?.projectId,
    draftId: opts?.draftId,
    data: {},
    warnings: [],
    error: { code, message, details: opts?.details },
  };
}
