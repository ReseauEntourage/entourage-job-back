const { pbkdf2Sync, randomBytes } = require('crypto');
const uuid = require('uuid');

// TODO remove duplicate
function encryptPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 10000, 512, 'sha512').toString('hex');

  return {
    salt,
    hash,
  };
}

const password = 'Admin123!';

const { hash, salt } = encryptPassword(password);

module.exports = {
  up: (queryInterface) => {
    return queryInterface.bulkInsert('Users', [
      {
        id: uuid.v4(),
        email: 'admin@entourage.social',
        firstName: 'John',
        lastName: 'Doe',
        role: 'Admin',
        adminRole: null,
        password: hash,
        salt,
        gender: 0,
        phone: '+33699999999',
        zone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  down: (queryInterface) => {
    return queryInterface.bulkDelete('Users', null, {});
  },
};
