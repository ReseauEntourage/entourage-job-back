module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Users', 'OrganizationId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'Organizations',
        key: 'id',
      },
    });
  },

  down: (queryInterface) => {
    return queryInterface.removeColumn('Users', 'OrganizationId');
  },
};
