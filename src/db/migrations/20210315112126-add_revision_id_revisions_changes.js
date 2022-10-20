module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('RevisionChanges', 'RevisionId', {
      allowNull: true,
      type: Sequelize.UUID,
    });
  },
  down: (queryInterface) => {
    return queryInterface.removeColumn('RevisionChanges', 'RevisionId');
  },
};
