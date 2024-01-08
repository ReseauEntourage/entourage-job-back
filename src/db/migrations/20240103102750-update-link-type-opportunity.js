module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('Opportunities', 'link', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('Opportunities', 'link', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },
};
