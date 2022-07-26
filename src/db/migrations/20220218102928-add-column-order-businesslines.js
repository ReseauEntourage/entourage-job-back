export default {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn('BusinessLines', 'order', {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: -1,
      }),
    ]);
  },
  down: (queryInterface) => {
    return Promise.all([queryInterface.removeColumn('BusinessLines', 'order')]);
  },
};
