module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('User_Profiles', 'isAvailable', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('User_Profiles', 'isAvailable');
  },
};
