'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.dropTable('UserProfileExperiences', {
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
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
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
      await queryInterface.removeColumn('Experiences', 'userProfileId', {
        transaction,
      });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
