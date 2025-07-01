const ioRedisMock = jest.fn().mockImplementation(() => ({
  on: jest.fn().mockReturnThis(),
  once: jest.fn().mockReturnThis(),
  emit: jest.fn().mockReturnThis(),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  quit: jest.fn().mockResolvedValue('OK'),
  set: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(1),
  exists: jest.fn().mockResolvedValue(0),
  expire: jest.fn().mockResolvedValue(1),
  scan: jest.fn().mockResolvedValueOnce(['0', []]),
  pipeline: jest.fn().mockReturnValue({
    set: jest.fn().mockReturnThis(),
    get: jest.fn().mockReturnThis(),
    del: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  }),
  multi: jest.fn().mockReturnValue({
    set: jest.fn().mockReturnThis(),
    get: jest.fn().mockReturnThis(),
    del: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  }),
  setex: jest.fn().mockResolvedValue('OK'),
}));

// eslint-disable-next-line import/no-default-export
export default ioRedisMock;
