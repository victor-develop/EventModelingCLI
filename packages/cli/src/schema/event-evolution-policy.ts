import type { EventField } from '../domain/types';

export type EventFieldEvolutionWarningCode =
  | 'EVENT_FIELD_TYPE_CHANGED'
  | 'EVENT_FIELD_REMOVED'
  | 'EVENT_FIELD_REQUIREDNESS_CHANGED'
  | 'EVENT_FIELD_RENAMED';

export interface EventFieldEvolutionWarning {
  code: EventFieldEvolutionWarningCode;
  message: string;
  eventId: string;
  fieldId: string;
  before: EventField;
  after: EventField | null;
  recommendation: string;
}

export type EventEvolutionAcknowledgementSource =
  | 'interactive-confirmation'
  | 'suppress-warning';

export interface EventEvolutionAcknowledgement {
  source: EventEvolutionAcknowledgementSource;
  compatibilityWarningCodes?: EventFieldEvolutionWarningCode[];
}

export const EVENT_EVOLUTION_RECOMMENDATION = [
  'Published or persisted Events should normally evolve additively:',
  '1. add a replacement field;',
  '2. keep or deprecate the old field;',
  '3. migrate producers and consumers;',
  '4. remove the old field at an explicit compatibility boundary.',
].join(' ');

export function assessEventFieldEvolution(
  eventId: string,
  before: EventField,
  after: EventField | null,
): EventFieldEvolutionWarning[] {
  const warning = (
    code: EventFieldEvolutionWarningCode,
    message: string,
  ): EventFieldEvolutionWarning => ({
    code,
    message,
    eventId,
    fieldId: before.fieldId,
    before: cloneField(before),
    after: after ? cloneField(after) : null,
    recommendation: EVENT_EVOLUTION_RECOMMENDATION,
  });

  if (!after) {
    return [warning(
      'EVENT_FIELD_REMOVED',
      `Event field ${eventId}.${before.fieldId} was removed and may break existing consumers.`,
    )];
  }

  const warnings: EventFieldEvolutionWarning[] = [];
  if (before.type !== after.type) {
    warnings.push(warning(
      'EVENT_FIELD_TYPE_CHANGED',
      `Event field ${eventId}.${before.fieldId} changed type and may break existing consumers.`,
    ));
  }
  if (!before.required && after.required) {
    warnings.push(warning(
      'EVENT_FIELD_REQUIREDNESS_CHANGED',
      `Event field ${eventId}.${before.fieldId} became required and may break existing producers or consumers.`,
    ));
  }
  if (before.name !== after.name) {
    warnings.push(warning(
      'EVENT_FIELD_RENAMED',
      `Event field ${eventId}.${before.fieldId} was renamed and may break consumers bound by payload path.`,
    ));
  }
  return warnings;
}

function cloneField(field: EventField): EventField {
  return { ...field };
}
