module.exports = {
  up: (queryInterface) => {
    return Promise.all([
      queryInterface.addIndex('CVs', ['UserId']),
      queryInterface.addIndex('CVs', ['status', 'UserId']),
    ]);
  },

  down: (queryInterface) => {
    return Promise.all([
      queryInterface.removeIndex('CVs', ['UserId']),
      queryInterface.removeIndex('CVs', ['status', 'UserId']),
    ]);
  },
};
