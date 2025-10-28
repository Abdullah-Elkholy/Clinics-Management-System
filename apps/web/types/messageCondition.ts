export type ConditionOperator = 'EQUAL' | 'GREATER' | 'LESS' | 'RANGE';

export interface MessageCondition {
  id: string; // unique id (uuid)
  name?: string; // friendly name for admin
  priority: number; // 1 = highest priority (checked first)
  enabled?: boolean;

  // matching operator
  operator: ConditionOperator;
  // value used for EQUAL / GREATER / LESS
  value?: number;
  // for RANGE
  minValue?: number;
  maxValue?: number;

  // message template (use placeholders: {PN}, {PQP}, {ETR}, {DN})
  template: string;
}

export interface QueueMessageConfig {
  queueId: string;
  queueName?: string;
  defaultTemplate?: string; // fallback template
  conditions: MessageCondition[];
}

export type MessageResolutionReason = 'CONDITION' | 'DEFAULT' | 'EXCLUDED' | 'NO_MATCH';

export interface MessageResolution {
  patientId: string;
  patientName?: string;
  patientPosition: number;
  offset: number; // patientPosition - currentQueuePosition
  matchedConditionId?: string;
  resolvedTemplate?: string; // final text after replacement
  reason: MessageResolutionReason;
}
