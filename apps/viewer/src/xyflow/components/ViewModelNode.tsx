import { BaseOccurrenceNode } from './BaseOccurrenceNode';

export function ViewModelNode(props: Parameters<typeof BaseOccurrenceNode>[0]) {
  return <BaseOccurrenceNode {...props} />;
}
