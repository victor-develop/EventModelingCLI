import { BaseOccurrenceNode } from './BaseOccurrenceNode';

export function EventNode(props: Parameters<typeof BaseOccurrenceNode>[0]) {
  return <BaseOccurrenceNode {...props} />;
}
