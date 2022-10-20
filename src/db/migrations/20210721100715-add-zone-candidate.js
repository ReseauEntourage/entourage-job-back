module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Users', 'zone', {
      allowNull: true,
      type: Sequelize.STRING,
    });
  },
  down: (queryInterface) => {
    return queryInterface.removeColumn('Users', 'zone');
  },
};
