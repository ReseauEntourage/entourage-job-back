export default {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.addColumn(
          'CVs',
          'visibility',
          {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
            allowNull: false,
          },
          {
            transaction: t,
          }
        ),
        queryInterface.addColumn(
          'CVs',
          'version',
          {
            type: Sequelize.INTEGER,
            defaultValue: 1,
            allowNull: false,
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
        queryInterface.removeColumn('CVs', 'visibility', {
          transaction: t,
        }),
        queryInterface.removeColumn('CVs', 'version', {
          transaction: t,
        }),
      ]);
    });
  },
};
