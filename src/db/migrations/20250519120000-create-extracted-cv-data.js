'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ExtractedCVData', {
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
      data: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      fileHash: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      schemaVersion: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // Création d'un index sur userProfileId pour optimiser les recherches
    await queryInterface.addIndex('ExtractedCVData', ['userProfileId']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('ExtractedCVData');
  },
};
