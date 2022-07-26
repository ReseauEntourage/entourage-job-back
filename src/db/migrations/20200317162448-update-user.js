export default {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.addColumn(
          'Users',
          'hashReset',
          {
            type: Sequelize.TEXT,
            allowNull: true,
          },
          {
            transaction: t,
          }
        ),
        queryInterface.addColumn(
          'Users',
          'saltReset',
          {
            type: Sequelize.STRING,
            allowNull: true,
          },
          {
            transaction: t,
          }
        ),
      ]);
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.removeColumn('Users', 'hashReset', {
          transaction: t,
        }),
        queryInterface.removeColumn('Users', 'saltReset', {
          transaction: t,
        }),
      ]);
    });
  },
};
