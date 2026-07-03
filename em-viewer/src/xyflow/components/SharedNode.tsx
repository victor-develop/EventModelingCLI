import { BaseOccurrenceNode } from './BaseOccurrenceNode';

export function SharedNode(props: Parameters<typeof BaseOccurrenceNode>[0]) {
  return <BaseOccurrenceNode {...props} />;
}
