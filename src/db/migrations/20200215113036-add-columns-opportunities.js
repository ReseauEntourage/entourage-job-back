module.exports = {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn('Opportunities', 'isValidated', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      }),
      queryInterface.addColumn('Opportunities', 'isArchived', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      }),
    ]);
  },
  down: (queryInterface) => {
    return Promise.all([
      queryInterface.removeColumn('Opportunities', 'isValidated'),
      queryInterface.removeColumn('Opportunities', 'isArchived'),
    ]);
  },
};
