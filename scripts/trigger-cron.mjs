/**
 * Manually triggers a cron task job by pushing it into the BullMQ cron-tasks queue.
 *
 * Usage:
 *   node scripts/trigger-cron.mjs <job-name>
 *
 * Available job names:
 *   send_reminder_to_user_not_completed_onboarding
 *   delete_inactive_users
 *   prepare_post_onboarding_completion_mails
 *   prepare_not_completed_profile_mails
 *   prepare_user_without_response_to_first_message_mails
 *   prepare_user_conversation_follow_up_mails
 *   prepare_recommendation_mails
 *   prepare_auto_set_unavailable_users
 *   process_expired_achievements
 *   prepare_super_engaged_achievement_reminder_mails
 */

import { Queue } from 'bullmq';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

const CRON_JOBS = [
  'send_reminder_to_user_not_completed_onboarding',
  'delete_inactive_users',
  'prepare_post_onboarding_completion_mails',
  'prepare_not_completed_profile_mails',
  'prepare_user_without_response_to_first_message_mails',
  'prepare_user_conversation_follow_up_mails',
  'prepare_recommendation_mails',
  'prepare_auto_set_unavailable_users',
  'process_expired_achievements',
  'prepare_super_engaged_achievement_reminder_mails',
];

const jobName = process.argv[2];

if (!jobName) {
  console.error('Usage: node scripts/trigger-cron.mjs <job-name>');
  console.error('\nAvailable jobs:');
  CRON_JOBS.forEach((j) => console.error(`  ${j}`));
  process.exit(1);
}

if (!CRON_JOBS.includes(jobName)) {
  console.error(`Unknown job: "${jobName}"`);
  console.error('\nAvailable jobs:');
  CRON_JOBS.forEach((j) => console.error(`  ${j}`));
  process.exit(1);
}

// Parse Redis URL from env (falls back to localhost for local dev).
// Docker service hostnames (e.g. "redis") are replaced with "localhost"
// so the script can connect from outside the Docker network.
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const url = new URL(redisUrl);
const host = url.hostname === 'redis' ? 'localhost' : url.hostname;

const connection = {
  host,
  port: parseInt(url.port || '6379', 10),
  ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
};

const queue = new Queue('cron-tasks', { connection });

try {
  const job = await queue.add(jobName, {});
  console.log(`✓ Job "${jobName}" added to cron-tasks queue (id: ${job.id})`);
} catch (err) {
  console.error('Failed to add job:', err.message);
  process.exit(1);
} finally {
  await queue.close();
}
