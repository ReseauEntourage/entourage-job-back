export default {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn('Opportunities', 'contactMail', {
        allowNull: true,
        type: Sequelize.STRING,
      }),
    ]);
  },
  down: (queryInterface) => {
    return Promise.all([
      queryInterface.removeColumn('Opportunities', 'contactMail'),
    ]);
  },
};
