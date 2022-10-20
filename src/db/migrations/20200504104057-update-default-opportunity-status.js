module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.changeColumn('Opportunity_Users', 'status', {
      type: Sequelize.INTEGER,
      defaultValue: -1,
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.changeColumn('Opportunity_Users', 'status', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    });
  },
};
