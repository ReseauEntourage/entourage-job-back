export default {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Opportunities', 'message', {
      allowNull: true,
      type: Sequelize.TEXT,
    });
  },
  down: (queryInterface) => {
    return queryInterface.removeColumn('Opportunities', 'message');
  },
};
