export default {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.addColumn(
          'Users',
          'userToCoach',
          {
            type: Sequelize.UUID,
            allowNull: true,
            references: {
              model: 'Users',
              key: 'id',
            },
          },
          {
            transaction: t,
          }
        ),
        queryInterface.removeColumn('Users', 'isAdmin', {
          transaction: t,
        }),
        queryInterface.changeColumn(
          'Users',
          'role',
          {
            type: Sequelize.STRING,
            allowNull: false,
            defaultValue: 'Candidat',
          },
          {
            transaction: t,
          }
        ),
      ]);
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.removeColumn('Users', 'userToCoach', {
          transaction: t,
        }),
        queryInterface.addColumn(
          'Users',
          'isAdmin',
          {
            allowNull: false,
            defaultValue: false,
            type: Sequelize.BOOLEAN,
          },
          {
            transaction: t,
          }
        ),
        queryInterface.changeColumn(
          'Users',
          'role',
          {
            type: Sequelize.STRING,
          },
          {
            transaction: t,
          }
        ),
      ]);
    });
  },
};
