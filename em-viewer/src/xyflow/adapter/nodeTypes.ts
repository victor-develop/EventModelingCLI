import type { NodeTypes } from '@xyflow/react';
import { SwimlaneGroupNode } from '../components/SwimlaneGroupNode';
import { CommandNode } from '../components/CommandNode';
import { EventNode } from '../components/EventNode';
import { ViewModelNode } from '../components/ViewModelNode';
import { SharedNode } from '../components/SharedNode';
import { FrontierHandleNode } from '../components/FrontierHandleNode';

export const nodeTypes = {
  swimlaneGroup: SwimlaneGroupNode,
  'em.cmd': CommandNode,
  'em.evt': EventNode,
  'em.viewModel': ViewModelNode,
  'em.ui': SharedNode,
  'em.trigger': SharedNode,
  'em.proc': SharedNode,
  'em.shared': SharedNode,
  frontierHandle: FrontierHandleNode,
} satisfies NodeTypes;
