module.exports = {
  up: (queryInterface) => {
    return queryInterface.removeColumn('RevisionChanges', 'RevisionId');
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('RevisionChanges', 'RevisionId', {
      allowNull: true,
      type: Sequelize.UUID,
    });
  },
};
