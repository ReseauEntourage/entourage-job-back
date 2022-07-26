export default {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn('Opportunities', 'createdBy', {
        allowNull: true,
        type: Sequelize.UUID,
      }),
    ]);
  },
  down: (queryInterface) => {
    return Promise.all([
      queryInterface.removeColumn('Opportunities', 'createdBy'),
    ]);
  },
};
