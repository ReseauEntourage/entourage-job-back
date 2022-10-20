module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface
      .describeTable('Opportunity_Users')
      .then((tableDefinition) => {
        if (!tableDefinition.revision) {
          return queryInterface.addColumn('Opportunity_Users', 'revision', {
            allowNull: true,
            type: Sequelize.INTEGER,
          });
        }
        return Promise.resolve();
      });
  },
  down: (queryInterface) => {
    return queryInterface.removeColumn('Opportunity_Users', 'revision');
  },
};
