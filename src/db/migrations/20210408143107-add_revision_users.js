module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.describeTable('Users').then((tableDefinition) => {
      if (!tableDefinition.revision) {
        return queryInterface.addColumn('Users', 'revision', {
          allowNull: true,
          type: Sequelize.INTEGER,
        });
      }
      return Promise.resolve(true);
    });
  },
  down: () => {
    return Promise.resolve(true);
  },
};
