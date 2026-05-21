/**
 * HRIS Event Emitter
 *
 * Publishes events to BullMQ queues for downstream processing:
 *   "new-hire"    → triggers onboarding learning path assignment
 *   "role-change" → triggers training reassignment based on new job title
 *
 * These events are consumed by workers (Phase 5: Notifications / Assignments).
 * For now the events are enqueued so they can be processed when workers exist.
 */
import { Queue } from "bullmq";
import { redisConnection } from "@/lib/redis";

export type HrisEventType = "new-hire" | "role-change";

export interface NewHirePayload {
  tenantId: string;
  email: string;
  hireDate: Date;
}

export interface RoleChangePayload {
  tenantId: string;
  userId: string;
  previousJobTitleId?: string;
  newJobTitleName?: string;
}

export type HrisEventPayload = NewHirePayload | RoleChangePayload;

// Lazy singleton — not created until first emit
let _hrisEventQueue: Queue | null = null;
function getHrisEventQueue(): Queue {
  if (!_hrisEventQueue) {
    _hrisEventQueue = new Queue("hris-events", { connection: redisConnection });
  }
  return _hrisEventQueue;
}

export async function emitHrisEvent(
  type: HrisEventType,
  payload: HrisEventPayload,
): Promise<void> {
  await getHrisEventQueue().add(type, payload, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  });
}
