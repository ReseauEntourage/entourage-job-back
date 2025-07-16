import 'openai/shims/node';
import { EventEmitter } from 'events';

jest.mock('ioredis', () => {
  class MockRedis extends EventEmitter {
    private keyValueStore: Record<string, string> = {};

    constructor() {
      super();
      setTimeout(() => {
        this.emit('connect');
        this.emit('ready');
      }, 0);
    }

    on = jest.fn().mockImplementation((event, callback) => {
      super.on(event, callback);
      return this;
    });

    get = jest
      .fn()
      .mockImplementation((key) =>
        Promise.resolve(this.keyValueStore[key] || null)
      );
    set = jest.fn().mockImplementation((key, value) => {
      this.keyValueStore[key] = value;
      return Promise.resolve('OK');
    });
    del = jest.fn().mockImplementation((key) => {
      delete this.keyValueStore[key];
      return Promise.resolve(1);
    });
    flushall = jest.fn().mockImplementation(() => {
      this.keyValueStore = {};
      return Promise.resolve('OK');
    });
    quit = jest.fn().mockResolvedValue('OK');

    pipeline = jest.fn().mockImplementation(() => ({
      set: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    }));

    multi = jest.fn().mockImplementation(() => ({
      set: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    }));
  }

  return MockRedis;
});
