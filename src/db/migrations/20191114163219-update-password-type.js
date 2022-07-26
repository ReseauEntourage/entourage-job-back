export default {
  up: (queryInterface, Sequelize) => {
    return queryInterface.changeColumn('Users', 'password', {
      type: Sequelize.TEXT,
      allowNull: false,
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.changeColumn('Users', 'password', {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },
};
