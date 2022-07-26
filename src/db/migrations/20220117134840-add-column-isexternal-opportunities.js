export default {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn('Opportunities', 'isExternal', {
        allowNull: false,
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      }),
      queryInterface.addColumn('Opportunities', 'link', {
        allowNull: true,
        type: Sequelize.STRING,
      }),
      queryInterface.addColumn('Opportunities', 'externalOrigin', {
        allowNull: true,
        type: Sequelize.STRING,
      }),
    ]);
  },
  down: (queryInterface) => {
    return Promise.all([
      queryInterface.removeColumn('Opportunities', 'isExternal'),
      queryInterface.removeColumn('Opportunities', 'link'),
      queryInterface.removeColumn('Opportunities', 'externalOrigin'),
    ]);
  },
};
