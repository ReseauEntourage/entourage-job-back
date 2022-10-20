module.exports = {
  up: (queryInterface) => {
    return queryInterface
      .describeTable('RevisionChanges')
      .then((tableDefinition) => {
        if (tableDefinition.RevisionId) {
          return queryInterface.removeColumn('RevisionChanges', 'RevisionId');
        }
        return Promise.resolve();
      });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('RevisionChanges', 'RevisionId', {
      allowNull: true,
      type: Sequelize.UUID,
    });
  },
};
