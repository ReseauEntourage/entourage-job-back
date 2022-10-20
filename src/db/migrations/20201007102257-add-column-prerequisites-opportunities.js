module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Opportunities', 'prerequisites', {
      allowNull: true,
      type: Sequelize.TEXT,
    });
  },
  down: (queryInterface) => {
    return queryInterface.removeColumn('Opportunities', 'prerequisites');
  },
};
