export default {
  up: (queryInterface, Sequelize) => {
    return queryInterface.changeColumn('Users', 'email', {
      type: Sequelize.STRING,
      unique: true,
      allowNull: false,
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.changeColumn('Users', 'email', {
      type: Sequelize.STRING,
      unique: false,
      allowNull: false,
    });
  },
};
