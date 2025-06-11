'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.dropTable('UserProfileExperiences', {
        transaction,
      });
      await queryInterface.dropTable('UserProfileFormations', {
        transaction,
      });
      await queryInterface.addColumn(
        'Experiences',
        'userProfileId',
        {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'UserProfiles',
            key: 'id',
          },
        },
        {
          transaction,
        }
      );
      await queryInterface.addColumn(
        'Formations',
        'userProfileId',
        {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'UserProfiles',
            key: 'id',
          },
        },
        {
          transaction,
        }
      );
      await queryInterface.addColumn(
        'FormationSkills',
        'order',
        {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        {
          transaction,
        }
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeColumn('FormationSkills', 'order', {
        transaction,
      });
      await queryInterface.createTable(
        'UserProfileExperiences',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: () => {
              return UUID.v4();
            },
          },
          userProfileId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'UserProfiles',
              key: 'id',
            },
          },
          experienceId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'Experiences',
              key: 'id',
            },
          },
        },
        { transaction }
      );

      await queryInterface.createTable(
        'UserProfileFormations',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: () => {
              return UUID.v4();
            },
          },
          userProfileId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'UserProfiles',
              key: 'id',
            },
          },
          formationId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'Formations',
              key: 'id',
            },
          },
        },
        { transaction }
      );
      await queryInterface.removeColumn('Experiences', 'userProfileId', {
        transaction,
      });
      await queryInterface.removeColumn('Formations', 'userProfileId', {
        transaction,
      });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
