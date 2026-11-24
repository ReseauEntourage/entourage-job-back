const { randomUUID } = require('crypto');

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.addColumn(
          'CVs',
          'userId',
          {
            allowNull: false,
            type: Sequelize.UUID,
            defaultValue: randomUUID(),
          },
          {
            transaction: t,
          }
        ),
        queryInterface.addColumn(
          'CVs',
          'url',
          {
            allowNull: false,
            type: Sequelize.STRING,
            defaultValue: 'to-define',
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
        queryInterface.removeColumn('CVs', 'userId', {
          transaction: t,
        }),
        queryInterface.removeColumn('CVs', 'url', {
          transaction: t,
        }),
      ]);
    });
  },
};
