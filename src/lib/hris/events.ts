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

const hrisEventQueue = new Queue("hris-events", { connection: redisConnection });

export async function emitHrisEvent(
  type: HrisEventType,
  payload: HrisEventPayload,
): Promise<void> {
  await hrisEventQueue.add(type, payload, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  });
}
