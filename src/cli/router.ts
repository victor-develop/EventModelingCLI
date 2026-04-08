import { Workspace } from '../workspace/workspace';
import { CLIResult } from '../domain/types';
import * as cmd from './commands';

export interface ParsedArgs {
  group: string;
  subgroup?: string;
  action?: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

export function parseArgs(args: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  let i = 0;
  while (i < args.length) {
    const arg = args[i]!;
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i += 2;
      } else {
        flags[key] = true;
        i += 1;
      }
    } else {
      positional.push(arg);
      i += 1;
    }
  }

  const group = positional[0] ?? '';
  const subgroup = positional[1];
  const action = positional[2];
  return { group, subgroup, action, positional, flags };
}

function fs(flags: Record<string, string | boolean>, key: string): string {
  const v = flags[key];
  return typeof v === 'string' ? v : '';
}

export function routeCommand(ws: Workspace, rawArgs: string[]): CLIResult {
  const args = parseArgs(rawArgs);
  const { group, subgroup, action, positional, flags } = args;

  switch (group) {
    case 'project': {
      if (subgroup === 'init') return cmd.projectInit(ws, positional.slice(2).join(' '));
      if (subgroup === 'open') return cmd.projectOpen(ws, positional[2] ?? '');
      break;
    }
    case 'ctx': return cmd.ctx(ws);
    case 'draft': {
      if (subgroup === 'start') return cmd.draftStart(ws, fs(flags, 'n'));
      if (subgroup === 'status') return cmd.draftStatus(ws);
      if (subgroup === 'diff') return cmd.draftDiff(ws, fs(flags, 'format') || 'json');
      break;
    }
    case 'submit': return cmd.submit(ws, fs(flags, 'm'));
    case 'versions': return cmd.versions(ws);
    case 'checkout': return cmd.checkout(ws, positional[1] ?? '');
    case 'cmd': {
      if (subgroup === 'new') return cmd.cmdNew(ws, positional[2] ?? '', fs(flags, 'name') || undefined);
      break;
    }
    case 'evt': {
      if (subgroup === 'new') return cmd.evtNew(ws, positional[2] ?? '', fs(flags, 'name') || undefined);
      break;
    }
    case 'view': {
      if (subgroup === 'new') return cmd.viewNew(ws, positional[2] ?? '', fs(flags, 'name') || undefined);
      if (subgroup === 'field') {
        if (action === 'add') return cmd.viewFieldAdd(ws, positional[3] ?? '', fs(flags, 'field-id'), fs(flags, 'name'), fs(flags, 'type'), fs(flags, 'from-event'), fs(flags, 'path'), !!flags['nullable']);
        if (action === 'edit') return cmd.viewFieldEdit(ws, positional[3] ?? '', positional[4] ?? '', { ...flags });
        if (action === 'rm') return cmd.viewFieldRm(ws, positional[3] ?? '', positional[4] ?? '');
      }
      if (subgroup === 'schema' && action === 'show') return cmd.viewSchemaShow(ws, positional[3] ?? '');
      break;
    }
    case 'proc': {
      if (subgroup === 'new') return cmd.procNew(ws, positional[2] ?? '');
      if (subgroup === 'bind-view') return cmd.procBindView(ws, fs(flags, 'proc'), fs(flags, 'view'), fs(flags, 'fields') ? fs(flags, 'fields').split(',') : undefined);
      break;
    }
    case 'trigger': {
      if (subgroup === 'new') return cmd.triggerNew(ws, positional[2] ?? '');
      if (subgroup === 'issues-cmd') return cmd.triggerIssuesCmd(ws, fs(flags, 'trigger'), fs(flags, 'cmd'));
      break;
    }
    case 'story': {
      if (subgroup === 'add') return cmd.storyAdd(ws, positional[2] ?? '', fs(flags, 'title'), fs(flags, 'parent') || undefined, fs(flags, 'role') || undefined);
      if (subgroup === 'tree') return cmd.storyTree(ws);
      if (subgroup === 'bind') return cmd.storyBind(ws, fs(flags, 'story'), fs(flags, 'cmd'));
      if (subgroup === 'suggest-bind') return cmd.storySuggestBind(ws, fs(flags, 'story'), fs(flags, 'from-cmd') ? fs(flags, 'from-cmd').split(',') : [], (fs(flags, 'mode') || 'full') as 'core' | 'full');
      if (subgroup === 'revise-bind') return cmd.storyReviseBind(ws, fs(flags, 'proposal'), fs(flags, 'op'), { ...flags });
      if (subgroup === 'confirm-bind') return cmd.storyConfirmBind(ws, fs(flags, 'story'), fs(flags, 'proposal'));
      break;
    }
    case 'ui': {
      if (subgroup === 'add') return cmd.uiAdd(ws, positional[2] ?? '', fs(flags, 'name'), fs(flags, 'parent') || undefined);
      if (subgroup === 'tree') return cmd.uiTree(ws);
      if (subgroup === 'bind-view') return cmd.uiBindView(ws, fs(flags, 'ui'), fs(flags, 'view'), fs(flags, 'fields') ? fs(flags, 'fields').split(',') : undefined);
      if (subgroup === 'expose-cmd') return cmd.uiExposeCmd(ws, fs(flags, 'role'), fs(flags, 'ui'), fs(flags, 'cmd'));
      break;
    }
    case 'link': {
      if (subgroup === 'cmd->evt') return cmd.linkCmdEvt(ws, positional[2] ?? '', positional[3] ?? '');
      if (subgroup === 'evt->view') return cmd.linkEvtView(ws, positional[2] ?? '', positional[3] ?? '');
      break;
    }
    case 'show': return cmd.show(ws, positional[1] ?? '');
    case 'neighbors': return cmd.neighbors(ws, fs(flags, 'node'), fs(flags, 'direction') || 'both', fs(flags, 'edge-type') ? fs(flags, 'edge-type').split(',') : undefined, flags['limit'] ? Number(flags['limit']) : undefined);
    case 'walk': return cmd.walk(ws, fs(flags, 'from'), fs(flags, 'direction') || 'forward', fs(flags, 'edge-type') ? fs(flags, 'edge-type').split(',') : undefined, flags['max-hops'] ? Number(flags['max-hops']) : undefined, flags['limit'] ? Number(flags['limit']) : undefined);
    case 'trace': return cmd.trace(ws, fs(flags, 'from'), fs(flags, 'to'), flags['max-hops'] ? Number(flags['max-hops']) : undefined);
    case 'graph': return cmd.graph(ws, fs(flags, 'focus') || undefined, flags['depth'] ? Number(flags['depth']) : undefined, fs(flags, 'format') || 'mermaid');
    case 'layout': return cmd.layout(ws, fs(flags, 'focus'), fs(flags, 'direction') || 'both', flags['max-hops'] ? Number(flags['max-hops']) : undefined);
    case 'validate': return cmd.emValidate(ws);
    case 'review': {
      if (subgroup === 'impact') {
        if (action === 'evt') return cmd.reviewImpactEvt(ws, positional[3] ?? '');
        if (action === 'field') return cmd.reviewImpactField(ws, positional[3] ?? '', positional[4] ?? '');
      }
      return cmd.emReview(ws);
    }
  }

  return {
    ok: false,
    command: rawArgs.join(' '),
    data: {},
    warnings: [],
    error: { code: 'UNKNOWN_COMMAND', message: `Unknown command: em ${rawArgs.join(' ')}` },
  };
}
