module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.describeTable('Shares').then((tableDefinition) => {
      if (!tableDefinition.revision) {
        return queryInterface.addColumn('Shares', 'revision', {
          allowNull: true,
          type: Sequelize.INTEGER,
        });
      }
      return Promise.resolve();
    });
  },
  down: (queryInterface) => {
    return queryInterface.removeColumn('Shares', 'revision');
  },
};
