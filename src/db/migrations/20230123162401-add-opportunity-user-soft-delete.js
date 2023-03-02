module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Opportunity_Users', 'deletedAt', {
      allowNull: true,
      type: Sequelize.DATE,
    });
  },

  down: (queryInterface) => {
    return queryInterface.removeColumn('Opportunity_Users', 'deletedAt');
  },
};
