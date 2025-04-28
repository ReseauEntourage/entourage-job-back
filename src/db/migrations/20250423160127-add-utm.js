'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Utm', {
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
      utmSource: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null,
      },
      utmMedium: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null,
      },
      utmCampaign: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null,
      },
      utmTerm: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null,
      },
      utmContent: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null,
      },
      utmId: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null,
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
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Utm');
  },
};
