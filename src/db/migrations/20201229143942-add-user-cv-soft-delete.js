export default {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn('Users', 'deletedAt', {
        type: Sequelize.DATE,
      }),
      queryInterface.addColumn('CVs', 'deletedAt', {
        type: Sequelize.DATE,
      }),
    ]);
  },
  down: (queryInterface) => {
    return Promise.all([
      queryInterface.removeColumn('Users', 'deletedAt'),
      queryInterface.removeColumn('CVs', 'deletedAt'),
    ]);
  },
};
