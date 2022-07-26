export default {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Opportunities', 'department', {
      allowNull: true,
      type: Sequelize.STRING,
    });
  },
  down: (queryInterface) => {
    return queryInterface.removeColumn('Opportunities', 'department');
  },
};
