export default {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Users', 'adminRole', {
      allowNull: true,
      type: Sequelize.STRING,
    });
  },
  down: (queryInterface) => {
    return queryInterface.removeColumn('Users', 'adminRole');
  },
};
