export default {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Shares', 'other', {
      allowNull: false,
      defaultValue: 0,
      type: Sequelize.INTEGER,
    });
  },
  down: (queryInterface) => {
    return queryInterface.removeColumn('Shares', 'other');
  },
};
