module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('User_Profiles', 'department', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('User_Profiles', 'department');
  },
};
