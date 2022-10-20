module.exports = {
  up: (queryInterface) => {
    return Promise.all([
      queryInterface.addIndex('User_Candidats', ['hidden']),
      queryInterface.addIndex('CVs', ['version', 'UserId']),
    ]);
  },

  down: (queryInterface) => {
    return Promise.all([
      queryInterface.removeIndex('User_Candidats', ['hidden']),
      queryInterface.removeIndex('CVs', ['version', 'UserId']),
    ]);
  },
};
