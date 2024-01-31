module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('ExternalMessages', 'optInNewsletter', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('ExternalMessages', 'optInNewsletter');
  },
};
