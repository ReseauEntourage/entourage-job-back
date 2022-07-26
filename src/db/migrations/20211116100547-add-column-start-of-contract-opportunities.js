export default {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Opportunities', 'startOfContract', {
      allowNull: true,
      type: Sequelize.DATEONLY,
    });
  },
  down: (queryInterface) => {
    return queryInterface.removeColumn('Opportunities', 'startOfContract');
  },
};
