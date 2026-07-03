import { BaseOccurrenceNode } from './BaseOccurrenceNode';

export function CommandNode(props: Parameters<typeof BaseOccurrenceNode>[0]) {
  return <BaseOccurrenceNode {...props} />;
}
