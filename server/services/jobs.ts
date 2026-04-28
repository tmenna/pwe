/**
 * Lightweight background job queue — Phase 4
 *
 * A simple in-process async queue that handles fire-and-forget tasks
 * (email sending, cleanup, export generation) without external dependencies.
 *
 * Usage:
 *   jobQueue.add("send-email", () => sendNewMessageNotification({ ... }));
 *
 * Jobs run concurrently up to CONCURRENCY limit.
 * Failed jobs are logged and retried up to MAX_RETRIES times with exponential backoff.
 *
 * For production workloads requiring durability across restarts, replace this
 * with a persistent queue (Bull/BullMQ + Redis, or pg-boss).
 */

export type JobFn = () => Promise<unknown>;

interface Job {
  id: string;
  name: string;
  fn: JobFn;
  attempt: number;
}

const CONCURRENCY = parseInt(process.env.JOB_CONCURRENCY || "5", 10);
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 1000;

class JobQueue {
  private queue: Job[] = [];
  private running = 0;
  private counter = 0;

  /** Add a job to the queue. Returns immediately. */
  add(name: string, fn: JobFn): void {
    const job: Job = { id: String(++this.counter), name, fn, attempt: 0 };
    this.queue.push(job);
    this.tick();
  }

  private tick(): void {
    while (this.running < CONCURRENCY && this.queue.length > 0) {
      const job = this.queue.shift()!;
      this.running++;
      this.run(job).finally(() => {
        this.running--;
        this.tick();
      });
    }
  }

  private async run(job: Job): Promise<void> {
    job.attempt++;
    try {
      await job.fn();
      console.log(`[jobs] ✓ ${job.name} (id=${job.id})`);
    } catch (err: any) {
      console.error(`[jobs] ✗ ${job.name} attempt ${job.attempt}:`, err?.message || err);
      if (job.attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_MS * Math.pow(2, job.attempt - 1);
        console.log(`[jobs] Retrying ${job.name} in ${delay}ms…`);
        await wait(delay);
        this.queue.unshift(job); // push to front for quick retry
        this.tick();
      } else {
        console.error(`[jobs] ${job.name} failed after ${job.attempt} attempts — giving up.`);
      }
    }
  }

  get stats(): { queued: number; running: number } {
    return { queued: this.queue.length, running: this.running };
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Singleton job queue */
export const jobQueue = new JobQueue();
