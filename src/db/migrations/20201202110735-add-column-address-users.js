module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Users', 'address', {
      allowNull: true,
      type: Sequelize.STRING,
    });
  },
  down: (queryInterface) => {
    return queryInterface.removeColumn('Users', 'address');
  },
};
