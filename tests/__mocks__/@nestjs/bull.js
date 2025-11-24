// Mock pour @nestjs/bull

// Création d'un mock de queue
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
      progress: jest.fn(),
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
const queueMocks = {};

// Fonction pour générer les tokens de queue
function getQueueToken(name) {
  return `BullQueue_${name}`;
}

// Décorateur InjectQueue
function InjectQueue(queueName) {
  // Créer une queue mockée si elle n'existe pas encore
  if (!queueMocks[queueName]) {
    queueMocks[queueName] = createQueueMock();
  }

  // Retourner un décorateur qui injectera la queue mockée
  return function (target, key, index) {
    if (index !== undefined) {
      // Utilisé comme décorateur de paramètre (dans un constructeur)
      const originalConstructor = target;

      function newConstructor(...args) {
        args[index] = queueMocks[queueName];
        return new originalConstructor(...args);
      }

      newConstructor.prototype = originalConstructor.prototype;
      return newConstructor;
    } else if (key) {
      // Utilisé comme décorateur de propriété
      Object.defineProperty(target, key, {
        get: () => queueMocks[queueName],
        enumerable: true,
        configurable: true,
      });
    }
    return target;
  };
}

// Décorateur Process
function Process(queueOrOptions) {
  return function (target, key, descriptor) {
    return descriptor;
  };
}

// Décorateur Processor
function Processor(queueName) {
  return function (target) {
    return target;
  };
}

// Décorateurs d'événements
function OnQueueEvent(event) {
  return function (target, key, descriptor) {
    return descriptor;
  };
}

const OnQueueCompleted = () => OnQueueEvent('completed');
const OnQueueActive = () => OnQueueEvent('active');
const OnQueueFailed = () => OnQueueEvent('failed');
const OnQueueStalled = () => OnQueueEvent('stalled');
const OnQueueProgress = () => OnQueueEvent('progress');
const OnQueueError = () => OnQueueEvent('error');

// BullModule
const BullModule = {
  registerQueue: (options) => {
    const queueName = options.name || 'default';

    // Créer une queue mockée si elle n'existe pas encore
    if (!queueMocks[queueName]) {
      queueMocks[queueName] = createQueueMock();
    }

    return {
      module: class {},
      providers: [
        {
          provide: getQueueToken(queueName),
          useValue: queueMocks[queueName],
        },
      ],
      exports: [getQueueToken(queueName)],
    };
  },
  forRoot: () => ({
    module: class {},
    global: true,
    providers: [],
  }),
  forRootAsync: () => ({
    module: class {},
    global: true,
    providers: [],
    imports: [],
  }),
};

// Export des mocks
module.exports = {
  BullModule,
  InjectQueue,
  getQueueToken,
  Process,
  Processor,
  OnQueueActive,
  OnQueueCompleted,
  OnQueueError,
  OnQueueFailed,
  OnQueueProgress,
  OnQueueStalled,

  // Pour les tests
  createQueueMock,
  queueMocks,
};
