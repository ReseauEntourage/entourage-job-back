module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Locations', 'order', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: -1,
    });
  },
  down: (queryInterface) => {
    return queryInterface.removeColumn('Locations', 'order');
  },
};
