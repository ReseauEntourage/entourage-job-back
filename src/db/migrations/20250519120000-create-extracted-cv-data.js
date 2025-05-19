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
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
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
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // Création d'un index sur UserId pour optimiser les recherches
    await queryInterface.addIndex('ExtractedCVData', ['userId']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('ExtractedCVData');
  },
};
