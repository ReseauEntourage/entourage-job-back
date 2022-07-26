export default {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Experiences', 'order', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: -1,
    });
  },
  down: (queryInterface) => {
    return queryInterface.removeColumn('Experiences', 'order');
  },
};
