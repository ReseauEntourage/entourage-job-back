// Mock pour bull npm package
const createQueueMock = () => ({
  add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
  addBulk: jest
    .fn()
    .mockResolvedValue([{ id: 'mock-job-id-1' }, { id: 'mock-job-id-2' }]),
  process: jest.fn(),
  on: jest.fn(),
  getJob: jest.fn().mockImplementation((id) =>
    Promise.resolve({
      id,
      data: { mockData: 'test' },
      progress: jest.fn().mockReturnThis(),
      finished: jest.fn().mockResolvedValue(true),
      remove: jest.fn().mockResolvedValue(true),
    })
  ),
  getJobs: jest.fn().mockResolvedValue([]),
  pause: jest.fn().mockResolvedValue({}),
  resume: jest.fn().mockResolvedValue({}),
  count: jest.fn().mockResolvedValue(0),
  getCompleted: jest.fn().mockResolvedValue([]),
  getFailed: jest.fn().mockResolvedValue([]),
  getDelayed: jest.fn().mockResolvedValue([]),
  getActive: jest.fn().mockResolvedValue([]),
  getWaiting: jest.fn().mockResolvedValue([]),
  clean: jest.fn().mockResolvedValue(0),
});

// Stockage des queues mockées pour référence
const queueInstances = {};

// Mock Queue constructor
const Queue = jest.fn().mockImplementation((name, options) => {
  if (!queueInstances[name]) {
    queueInstances[name] = createQueueMock();
  }
  return queueInstances[name];
});

// Other classes/constants from bull
const QueueEvents = jest.fn().mockImplementation(() => ({
  on: jest.fn(),
}));

const QueueScheduler = jest.fn().mockImplementation(() => ({
  on: jest.fn(),
}));

// Mock constants that Bull exports
const FAILED = 'failed';
const COMPLETED = 'completed';
const ACTIVE = 'active';
const DELAYED = 'delayed';
const WAITING = 'waiting';
const PAUSED = 'paused';

// eslint-disable-next-line import/no-default-export
export default {
  Queue,
  QueueEvents,
  QueueScheduler,
  FAILED,
  COMPLETED,
  ACTIVE,
  DELAYED,
  WAITING,
  PAUSED,

  // Exposer les instances de queue pour permettre aux tests d'y accéder
  __queueInstances: queueInstances,

  // Réinitialiser toutes les mocks pour les tests
  __resetMocks: () => {
    Object.keys(queueInstances).forEach((key) => {
      delete queueInstances[key];
    });
  },
};
