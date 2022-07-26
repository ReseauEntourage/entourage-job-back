export default {
  up: (queryInterface, Sequelize) => {
    return queryInterface.changeColumn('Opportunities', 'link', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.changeColumn('Opportunities', 'link', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
};
