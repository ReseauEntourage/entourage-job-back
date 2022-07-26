export default {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Opportunity_Users', 'recommended', {
      allowNull: false,
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });
  },
  down: (queryInterface) => {
    return queryInterface.removeColumn('Opportunity_Users', 'recommended');
  },
};
