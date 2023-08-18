module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('ExternalMessages', 'optInNewsletter', {
      type: Sequelize.BOOLEAN,
      false: true,
      default: false,
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('ExternalMessages', 'optInNewsletter');
  },
};
