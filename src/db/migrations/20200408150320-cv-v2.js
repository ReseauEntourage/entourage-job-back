export default {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.createTable(
          'Experience_Skills',
          {
            id: {
              type: Sequelize.INTEGER,
              primaryKey: true,
              autoIncrement: true,
              allowNull: false,
            },
            ExperienceId: {
              type: Sequelize.UUID,
              allowNull: false,
              references: {
                model: 'Experiences',
                key: 'id',
              },
            },
            SkillId: {
              type: Sequelize.UUID,
              allowNull: false,
              references: {
                model: 'Skills',
                key: 'id',
              },
            },
            createdAt: {
              allowNull: false,
              type: Sequelize.DATE,
            },
            updatedAt: {
              allowNull: false,
              type: Sequelize.DATE,
            },
          },
          {
            transaction: t,
          }
        ),
        queryInterface.removeColumn('Experiences', 'dateStart', {
          transaction: t,
        }),
        queryInterface.removeColumn('Experiences', 'dateEnd', {
          transaction: t,
        }),
        queryInterface.removeColumn('Experiences', 'title', {
          transaction: t,
        }),
      ]);
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.addColumn(
          'Experiences',
          'title',
          {
            type: Sequelize.STRING,
          },
          {
            transaction: t,
          }
        ),
        queryInterface.addColumn(
          'Experiences',
          'dateStart',
          {
            type: Sequelize.STRING,
          },
          {
            transaction: t,
          }
        ),
        queryInterface.addColumn(
          'Experiences',
          'dateEnd',
          {
            type: Sequelize.STRING,
            allowNull: true,
          },
          {
            transaction: t,
          }
        ),
        queryInterface.dropTable('Experience_Skills', {
          transaction: t,
        }),
      ]);
    });
  },
};
