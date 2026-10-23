import { MetricsRecorder } from '@bull-board/metrics';
import { MetricsTime } from 'bullmq';
import { QueuesMetricsRecorderService } from 'src/queues/consumers/queues-metrics-recorder.service';
import {
  QUEUES_METRICS_HISTORY_RETENTION_DAYS,
  WORKER_METRICS_OPTIONS,
} from 'src/queues/queues.utils';

jest.mock('@bull-board/api/bullMQAdapter', () => ({
  BullMQAdapter: jest.fn().mockImplementation((queue) => ({ queue })),
}));

jest.mock('@bull-board/metrics', () => ({
  MetricsRecorder: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
  })),
}));

describe('QueuesMetricsRecorderService', () => {
  const buildQueue = (name: string) => ({ name, opts: {} });

  const build = () => {
    const redisClient = {};
    const service = new QueuesMetricsRecorderService(
      redisClient as never,
      buildQueue('work') as never,
      buildQueue('profile-generation') as never,
      buildQueue('cron-tasks') as never,
      buildQueue('embedding') as never
    );
    const recorder = (MetricsRecorder as unknown as jest.Mock).mock.results[0]
      .value;
    return { service, redisClient, recorder };
  };

  beforeEach(() => {
    (MetricsRecorder as unknown as jest.Mock).mockClear();
  });

  it('records the 4 queues on the shared Redis client with a 30 days retention', () => {
    const { redisClient } = build();

    const options = (MetricsRecorder as unknown as jest.Mock).mock.calls[0][0];
    expect(options.queues).toHaveLength(4);
    expect(options.connection).toBe(redisClient);
    expect(options.retentionDays).toBe(30);
    expect(QUEUES_METRICS_HISTORY_RETENTION_DAYS).toBe(30);
  });

  it('starts the recorder on init and stops it on destroy', () => {
    const { service, recorder } = build();

    service.onModuleInit();
    expect(recorder.start).toHaveBeenCalledTimes(1);
    expect(recorder.stop).not.toHaveBeenCalled();

    service.onModuleDestroy();
    expect(recorder.stop).toHaveBeenCalledTimes(1);
  });

  it('keeps one week of native BullMQ metrics on the workers', () => {
    expect(WORKER_METRICS_OPTIONS).toEqual({
      maxDataPoints: MetricsTime.ONE_WEEK,
    });
  });
});
